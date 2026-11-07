# Правила R8 для CV Maker (com.savoj13.freecv).
# ФАЙЛ ГЕНЕРУЄТЬСЯ скриптом scripts/install-native.mjs із native/proguard-rules.pro.tpl.
# Не редагуйте android/app/proguard-rules.pro вручну: зміни зникнуть. Правте шаблон у native/.

# Рядки коду в stack trace (разом із mapping.txt дають читабельні звіти про збої в Play Console)
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod
-renamesourcefileattribute SourceFile

# Capacitor: плагіни створюються за іменем класу з capacitor.plugins.json і викликаються
# з JS за іменами методів. Дублює consumer-правила capacitor-android: так надійніше.
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep public class * extends com.getcapacitor.BridgeActivity { *; }

# Місток WebView ↔ нативний код (виклики з JavaScript)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Наш плагін збереження PDF у «Завантаження»
-keep class com.savoj13.freecv.SaveFilePlugin { *; }
-keep class com.savoj13.freecv.MainActivity { *; }

# @capacitor-community/admob (сам Google Mobile Ads SDK і UMP мають власні consumer-правила)
-keep class com.getcapacitor.community.admob.** { *; }

# @capgo/native-purchases (Google Play Billing має власні consumer-правила)
-keep class ee.forgr.nativepurchases.** { *; }

# Офіційні плагіни Capacitor (app, filesystem, share) покриває правило extends Plugin вище.

# Попередження про класи, яких немає на Android (не впливають на роботу)
-dontwarn org.apache.cordova.**
