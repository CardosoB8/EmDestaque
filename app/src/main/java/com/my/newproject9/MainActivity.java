// MainActivity.java
package com.seuapp.smsmass;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.app.role.RoleManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Telephony;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class MainActivity extends AppCompatActivity {
    private EditText etNumbers;
    private EditText etMessage;
    private Button btnSend;

    private static final String[] PERMISSIONS = new String[] {
        Manifest.permission.SEND_SMS,
        Manifest.permission.RECEIVE_SMS,
        Manifest.permission.READ_SMS
    };
    private static final int REQUEST_SMS_PERM = 100;
    private static final int REQUEST_ROLE_SMS = 101;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        etNumbers = (EditText) findViewById(R.id.etNumbers);
        etMessage = (EditText) findViewById(R.id.etMessage);
        btnSend   = (Button)   findViewById(R.id.btnSend);

        if (!hasAllPermissions()) {
            ActivityCompat.requestPermissions(this, PERMISSIONS, REQUEST_SMS_PERM);
        }

        ensureDefaultSmsApp();

        btnSend.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String raw = etNumbers.getText().toString().trim();
                String msg = etMessage.getText().toString().trim();
                if (raw.isEmpty() || msg.isEmpty()) {
                    Toast.makeText(MainActivity.this,
                        "Preencha números e mensagem", Toast.LENGTH_SHORT).show();
                    return;
                }
                String[] array = raw.split("[;,\\s]+");
                List<String> list = Arrays.asList(array);
                Intent svc = new Intent(MainActivity.this, BulkSmsService.class);
                svc.putStringArrayListExtra("NUMBERS", new ArrayList<String>(list));
                svc.putExtra("MESSAGE", msg);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(svc);
                } else {
                    startService(svc);
                }
            }
        });
    }

    private boolean hasAllPermissions() {
        for (String p : PERMISSIONS) {
            if (ContextCompat.checkSelfPermission(this, p)
                    != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        return true;
    }

    private void ensureDefaultSmsApp() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            String def = Telephony.Sms.getDefaultSmsPackage(this);
            if (!getPackageName().equals(def)) {
                RoleManager rm = (RoleManager) getSystemService(ROLE_SERVICE);
                Intent i = rm.createRequestRoleIntent(RoleManager.ROLE_SMS);
                startActivityForResult(i, REQUEST_ROLE_SMS);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode,
        @NonNull String[] permissions, @NonNull int[] grantResults) {
        if (requestCode == REQUEST_SMS_PERM) {
            boolean ok = true;
            for (int r : grantResults) {
                if (r != PackageManager.PERMISSION_GRANTED) {
                    ok = false;
                    break;
                }
            }
            if (!ok) {
                Toast.makeText(this,
                    "Permissões SMS necessárias", Toast.LENGTH_LONG).show();
            }
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    @Override
    protected void onActivityResult(int requestCode,
        int resultCode, Intent data) {
        if (requestCode == REQUEST_ROLE_SMS) {
            if (resultCode == Activity.RESULT_OK) {
                Toast.makeText(this,
                    "App definido como padrão de SMS", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this,
                    "Permissão de app padrão negada", Toast.LENGTH_SHORT).show();
            }
        }
        super.onActivityResult(requestCode, resultCode, data);
    }
}
