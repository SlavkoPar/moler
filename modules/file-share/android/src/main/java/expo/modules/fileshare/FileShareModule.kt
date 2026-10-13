package expo.modules.fileshare

import android.content.ClipData
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.annotation.RequiresApi
import androidx.core.content.FileProvider
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/** Exports are kept in Download/moler, where the user can also find them in the Files app */
private val DOWNLOAD_FOLDER = "${Environment.DIRECTORY_DOWNLOADS}/moler/"

class FileShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FileShare")

    // Opens the share sheet for a file in the app's cache.
    //
    // On Android 10+ the file is first copied to Download/moler and that copy is shared. Google Drive
    // running inside GBox (Huawei phones without Google services) can't open files from the app's own
    // FileProvider: GBox reroutes the request into its sandbox and Drive gets "ENOENT", even though
    // the file exists. Files in the shared Download collection open normally.
    //
    // Every app that can receive the file is granted read access directly, because Huawei's share
    // sheet doesn't pass the grant on ("cannot issue a Uri permission grant").
    AsyncFunction("shareFileAsync") { fileUrl: String, mimeType: String, title: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val path = Uri.parse(fileUrl).path ?: throw IllegalArgumentException("Invalid file URL: $fileUrl")
      val file = File(path)

      val contentUri =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          copyToDownloads(context, file, mimeType)
        } else {
          // The provider declared by expo-sharing, which already covers the cache directory
          FileProvider.getUriForFile(context, "${context.packageName}.SharingFileProvider", file)
        }

      val send = Intent(Intent.ACTION_SEND).apply {
        setTypeAndNormalize(mimeType)
        putExtra(Intent.EXTRA_STREAM, contentUri)
        putExtra(Intent.EXTRA_TITLE, file.name)
        clipData = ClipData.newRawUri(file.name, contentUri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }

      context.packageManager
        .queryIntentActivities(send, PackageManager.MATCH_DEFAULT_ONLY)
        .forEach { context.grantUriPermission(it.activityInfo.packageName, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }

      activity.startActivity(Intent.createChooser(send, title))
    }
  }

  /** Writes the file to Download/moler (replacing an earlier copy with the same name) and returns its URI */
  @RequiresApi(Build.VERSION_CODES.Q)
  private fun copyToDownloads(context: Context, file: File, mimeType: String): Uri {
    val resolver = context.contentResolver
    val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI

    // Sharing the same export again reuses its file instead of adding "name (1).xml"
    val existing = resolver.query(
      collection,
      arrayOf(MediaStore.Downloads._ID),
      "${MediaStore.Downloads.DISPLAY_NAME} = ? AND ${MediaStore.Downloads.RELATIVE_PATH} = ?",
      arrayOf(file.name, DOWNLOAD_FOLDER),
      null
    )?.use { cursor ->
      if (cursor.moveToFirst()) Uri.withAppendedPath(collection, cursor.getLong(0).toString()) else null
    }

    val item = existing ?: resolver.insert(
      collection,
      ContentValues().apply {
        put(MediaStore.Downloads.DISPLAY_NAME, file.name)
        put(MediaStore.Downloads.MIME_TYPE, mimeType)
        put(MediaStore.Downloads.RELATIVE_PATH, DOWNLOAD_FOLDER)
        put(MediaStore.Downloads.IS_PENDING, 1)
      }
    ) ?: throw IllegalStateException("Could not create ${file.name} in Download")

    resolver.openOutputStream(item, "wt")?.use { output ->
      file.inputStream().use { input -> input.copyTo(output) }
    } ?: throw IllegalStateException("Could not write ${file.name} to Download")

    resolver.update(item, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }, null, null)
    return item
  }
}
