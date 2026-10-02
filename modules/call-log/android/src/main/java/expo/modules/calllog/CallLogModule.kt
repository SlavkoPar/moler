package expo.modules.calllog

import android.Manifest
import android.content.pm.PackageManager
import android.provider.CallLog
import android.provider.ContactsContract
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CallLogPermissionException :
  CodedException("ERR_CALL_LOG_PERMISSION", "READ_CALL_LOG permission has not been granted", null)

class CallLogModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CallLog")

    // Returns the most recent call log entry, or null when the log is empty
    AsyncFunction("getLastCallAsync") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      if (context.checkSelfPermission(Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
        throw CallLogPermissionException()
      }

      val projection = arrayOf(
        CallLog.Calls.NUMBER,
        CallLog.Calls.CACHED_NAME,
        CallLog.Calls.DATE,
        CallLog.Calls.TYPE,
        CallLog.Calls.DURATION,
        CallLog.Calls.GEOCODED_LOCATION,
        CallLog.Calls.CACHED_NUMBER_TYPE,
        CallLog.Calls.CACHED_NUMBER_LABEL,
        CallLog.Calls.COUNTRY_ISO,
        CallLog.Calls.FEATURES
      )
      // "LIMIT" in the sort order is rejected on newer Android versions, so read only the first row
      context.contentResolver.query(
        CallLog.Calls.CONTENT_URI,
        projection,
        null,
        null,
        "${CallLog.Calls.DATE} DESC"
      )?.use { cursor ->
        if (!cursor.moveToFirst()) return@AsyncFunction null

        // Label of the number in contacts, e.g. "Mobile"; only known when the number is a contact
        val numberType = cursor.getInt(6)
        val customLabel = cursor.getString(7)
        val numberLabel = if (numberType == 0 && customLabel.isNullOrEmpty()) {
          null
        } else {
          ContactsContract.CommonDataKinds.Phone
            .getTypeLabel(context.resources, numberType, customLabel)
            .toString()
        }

        mapOf(
          "number" to (cursor.getString(0) ?: ""),
          "name" to cursor.getString(1),
          "date" to cursor.getLong(2).toDouble(),
          "type" to callType(cursor.getInt(3)),
          "durationSeconds" to cursor.getLong(4).toDouble(),
          "geocodedLocation" to cursor.getString(5)?.takeIf { it.isNotEmpty() },
          "numberLabel" to numberLabel,
          "countryIso" to cursor.getString(8)?.takeIf { it.isNotEmpty() },
          "isVideo" to ((cursor.getInt(9) and CallLog.Calls.FEATURES_VIDEO) != 0)
        )
      }
    }
  }

  private fun callType(type: Int) = when (type) {
    CallLog.Calls.INCOMING_TYPE -> "incoming"
    CallLog.Calls.OUTGOING_TYPE -> "outgoing"
    CallLog.Calls.MISSED_TYPE -> "missed"
    CallLog.Calls.REJECTED_TYPE -> "rejected"
    CallLog.Calls.BLOCKED_TYPE -> "blocked"
    CallLog.Calls.VOICEMAIL_TYPE -> "voicemail"
    else -> "other"
  }
}
