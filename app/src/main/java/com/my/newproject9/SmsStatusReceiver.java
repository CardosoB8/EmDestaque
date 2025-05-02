// SmsStatusReceiver.java
package com.my.newproject9;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.telephony.SmsManager;
import android.widget.Toast;

public class SmsStatusReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        int result = getResultCode();

        if (ACTION_SMS_SENT.equals(action)) {
            if (result == Activity.RESULT_OK) {
                Toast.makeText(context, "SMS enviado", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(context, "Falha ao enviar SMS", Toast.LENGTH_SHORT).show();
            }
        }
        else if (ACTION_SMS_DELIVERED.equals(action)) {
            if (result == Activity.RESULT_OK) {
                Toast.makeText(context, "SMS entregue", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(context, "SMS não entregue", Toast.LENGTH_SHORT).show();
            }
        }
    }
}
