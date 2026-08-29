@echo off
REM ============================================================
REM  RONDA - Servidor de produccion (sirve dist/)
REM  Se inicia automaticamente al encender/iniciar sesion via
REM  el acceso en la carpeta Inicio (RONDA-Server.vbs)
REM  URL red local: https://192.168.1.51:5000  (HTTPS para camara en movil)
REM  Para publicar cambios: npm run build en esta carpeta
REM ============================================================
cd /d "C:\Users\Cesar Dla Croix\Desktop\ronda-app"
"C:\Program Files\nodejs\node.exe" "C:\Users\Cesar Dla Croix\Desktop\ronda-app\node_modules\vite\bin\vite.js" preview --host --port 5000
