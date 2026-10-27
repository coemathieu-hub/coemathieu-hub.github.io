package io.github.coemathieuhub.carnet;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.Toast;

import androidx.browser.customtabs.CustomTabsCallback;

/**
 * Lanceur de l'app : celui d'androidbrowserhelper, sans son plantage volontaire.
 *
 * Quand Chrome signale un défaut « qualité » (lien APK ↔ site pas encore vérifié, page en erreur,
 * premier lancement hors ligne), la bibliothèque fait planter l'app par défaut (règle du Play Store).
 * Ici, on l'accepte : Chrome affiche simplement la barre d'adresse et l'app reste utilisable.
 */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private static final String CRASH = "quality_enforcement.crash";

    @Override
    protected CustomTabsCallback getCustomTabsCallback() {
        return new CustomTabsCallback() {
            @Override
            public Bundle extraCallbackWithResult(String callbackName, Bundle args) {
                Bundle result = new Bundle();
                if (CRASH.equals(callbackName)) {
                    String reason = args == null ? null : args.getString("crash_reason");
                    Log.w("CarnetDeVoyage", "Défaut signalé par Chrome : " + reason);
                    // « success » = traité par l'app : Chrome ne ferme pas la fenêtre
                    result.putBoolean("success", true);
                    new Handler(Looper.getMainLooper()).post(() -> Toast.makeText(getApplicationContext(),
                            "Carnet de voyage : vérification du site en cours, réessaie plus tard si la barre d'adresse reste affichée.",
                            Toast.LENGTH_LONG).show());
                }
                return result;
            }
        };
    }
}
