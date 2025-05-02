// BulkSmsService.java
package com.my.newproject9;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.telephony.SmsManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.util.ArrayList;
import java.util.List;

public class BulkSmsService extends Service {
    private static final String CHANNEL_ID = "BulkSmsChannel";
    public static final String ACTION_SMS_SENT = "SMS_SENT";
    public static final String ACTION_SMS_DELIVERED = "SMS_DELIVERED";

    @Override
    public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Envio SMS", NotificationManager.IMPORTANCE_LOW);
            NotificationManager nm =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            nm.createNotificationChannel(ch);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ArrayList<String> numbers = intent.getStringArrayListExtra("NUMBERS");
        String message = intent.getStringExtra("MESSAGE");
        startForeground(1, buildNotification().build());
        sendBulk(numbers, message);
        stopSelf();
        return START_NOT_STICKY;
    }

    private NotificationCompat.Builder buildNotification() {
        Intent ni = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, ni, 0);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Enviando SMS em massa")
            .setContentText("Aguarde...")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pi);
    }

    private void sendBulk(List<String> numbers, String text) {
        SmsManager sm = SmsManager.getDefault();
        ArrayList<String> parts = new ArrayList<String>(
            sm.divideMessage(text)
        );
        for (String num : numbers) {
            ArrayList<PendingIntent> sentIntents = new ArrayList<PendingIntent>();
            ArrayList<PendingIntent> delIntents  = new ArrayList<PendingIntent>();
            for (int i = 0; i < parts.size(); i++) {
                Intent sent = new Intent(ACTION_SMS_SENT);
                PendingIntent spi = PendingIntent.getBroadcast(
                    this, 0, sent, 0);
                sentIntents.add(spi);

                Intent del = new Intent(ACTION_SMS_DELIVERED);
                PendingIntent dpi = PendingIntent.getBroadcast(
                    this, 0, del, 0);
                delIntents.add(dpi);
            }
            sm.sendMultipartTextMessage(
                num, null, parts, sentIntents, delIntents
            );
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
