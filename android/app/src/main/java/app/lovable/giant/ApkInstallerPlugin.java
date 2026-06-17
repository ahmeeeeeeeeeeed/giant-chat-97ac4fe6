package app.lovable.giant;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.List;

@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {
    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        boolean allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject result = new JSObject();
        result.put("allowed", allowed);
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");
        String contentType = call.getString("contentType", "application/vnd.android.package-archive");
        if (filePath == null || filePath.length() == 0) {
            call.reject("ملف التحديث غير موجود");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("فعّل إذن تثبيت التطبيقات من هذا المصدر، ثم أعد المحاولة");
            return;
        }

        try {
            Uri apkUri;
            if (filePath.startsWith("content://")) {
                apkUri = Uri.parse(filePath);
            } else {
                String normalizedPath = filePath.startsWith("file://")
                        ? Uri.parse(filePath).getPath()
                        : filePath;
                File apkFile = new File(normalizedPath);
                if (!apkFile.exists() || apkFile.length() == 0) {
                    call.reject("ملف التحديث غير موجود، أعد تنزيل التحديث مرة واحدة");
                    return;
                }
                apkUri = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N
                        ? FileProvider.getUriForFile(
                                getContext(),
                                getContext().getPackageName() + ".fileprovider",
                                apkFile
                        )
                        : Uri.fromFile(apkFile);
            }

            Intent intent = new Intent(
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.N
                            ? Intent.ACTION_INSTALL_PACKAGE
                            : Intent.ACTION_VIEW
            );
            intent.setDataAndType(apkUri, contentType);
            intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
            intent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
            intent.putExtra(Intent.EXTRA_INSTALLER_PACKAGE_NAME, getContext().getPackageName());
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            PackageManager pm = getContext().getPackageManager();
            if (intent.resolveActivity(pm) == null) {
                call.reject("تعذر العثور على مثبت Android");
                return;
            }
            List<ResolveInfo> installers = pm.queryIntentActivities(intent, 0);
            for (ResolveInfo installer : installers) {
                if (installer.activityInfo != null && installer.activityInfo.packageName != null) {
                    getContext().grantUriPermission(
                            installer.activityInfo.packageName,
                            apkUri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION
                    );
                }
            }

            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("started", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("تعذر فتح المثبت", e);
        }
    }
}