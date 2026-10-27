#!/bin/bash
# Lance l'APK publiée sur l'émulateur et récupère de quoi diagnostiquer (journal, écran, activité au premier plan).
# Appelé par .github/workflows/apk-test.yml ; les résultats partent sur la branche apk-test.
OUT=out; mkdir -p $OUT
PKG=io.github.coemathieuhub.carnet
adb wait-for-device
adb shell getprop ro.build.version.release > $OUT/android.txt
{ adb shell pm list packages | grep -iE "chrome|webview|browser"; adb shell dumpsys package com.android.chrome | grep -m1 versionName; } > $OUT/navigateurs.txt 2>&1
adb install -r carnet-de-voyage.apk > $OUT/installation.txt 2>&1
adb logcat -c
for essai in 1 2; do
  adb shell am start -W -n $PKG/.LauncherActivity > $OUT/lancement-$essai.txt 2>&1
  sleep 25
  adb exec-out screencap -p > $OUT/ecran-$essai.png
  adb shell dumpsys activity activities | grep -E "topResumedActivity|mResumedActivity" > $OUT/activite-$essai.txt 2>&1
  # Succès attendu : la fenêtre de Chrome (Trusted Web Activity) au premier plan, pas l'écran d'accueil
  if grep -qiE "customtabs|chrome" $OUT/activite-$essai.txt; then echo "OUVERTE" >> $OUT/activite-$essai.txt; else echo "PAS OUVERTE" >> $OUT/activite-$essai.txt; fi
  adb shell am force-stop $PKG
  sleep 3
done
adb logcat -d -v time > $OUT/logcat-complet.txt
grep -E "AndroidRuntime|FATAL|Exception|carnet|CarnetDeVoyage|TWA|Twa|QualityEnforce|DigitalAsset|OriginVerifier|cr_" $OUT/logcat-complet.txt > $OUT/logcat-filtre.txt || true
ls -la $OUT
exit 0
