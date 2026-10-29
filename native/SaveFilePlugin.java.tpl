package __APP_ID__;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.annotation.RequiresApi;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

/**
 * Zapis pliku w folderze „Pobrane” (Downloads) przez MediaStore.
 * Nie wymaga żadnych uprawnień w Androidzie 10 i nowszym. W starszych wersjach zwraca
 * „unimplemented”, a aplikacja wtedy otwiera okno „Udostępnij”.
 */
@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String data = call.getString("data");
        if (fileName == null || fileName.isEmpty() || data == null) {
            call.reject("fileName and data are required");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.unimplemented("Saving to Downloads needs Android 10 or newer");
            return;
        }
        saveToDownloads(call, fileName, mimeType, data);
    }

    @RequiresApi(api = Build.VERSION_CODES.Q)
    private void saveToDownloads(PluginCall call, String fileName, String mimeType, String data) {
        ContentResolver resolver = getContext().getContentResolver();
        Uri uri = null;
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);

            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);

            uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                throw new Exception("MediaStore insert failed");
            }
            try (OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) {
                    throw new Exception("openOutputStream failed");
                }
                out.write(bytes);
            }

            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, done, null, null);

            // System może dopisać „(1)”, gdy plik o tej nazwie już jest, więc odczytujemy prawdziwą nazwę
            String finalName = fileName;
            try (Cursor cursor = resolver.query(uri, new String[] {OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    String n = cursor.getString(0);
                    if (n != null && !n.isEmpty()) {
                        finalName = n;
                    }
                }
            }

            JSObject result = new JSObject();
            result.put("fileName", finalName);
            call.resolve(result);
        } catch (Exception e) {
            if (uri != null) {
                try {
                    resolver.delete(uri, null, null);
                } catch (Exception ignored) {
                    // nic więcej nie da się zrobić
                }
            }
            call.reject("Save failed: " + e.getMessage(), e);
        }
    }
}
