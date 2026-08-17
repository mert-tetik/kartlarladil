# FoxiesDeck Renderer Agent

Bu Electron uygulaması SELF görsel/video renderer'ını görünmeyen bir Chromium penceresinde sürdürür. Paketliyken Windows oturum açılışına eklenir ve aktif render sırasında bilgisayarın uyumasını engeller.

İlk eşleştirme için Studio’da bir renderer tokeni oluşturulur. Uygulamayı bir kez aşağıdaki ortam değişkenleriyle çalıştırmak tokeni Windows DPAPI ile şifreleyerek yerelde saklar:

```powershell
$env:FOXIESDECK_RENDERER_URL='https://www.foxiesdeck.com'
$env:FOXIESDECK_RENDERER_TOKEN='tek-seferlik-renderer-tokeni'
npm run renderer:dev
```

Token yalnız renderer kuyruğu erişimi verir; sosyal hesap veya AI anahtarları taşınmaz. Studio’dan iptal edilirse agent tekrar oturum alamaz.
