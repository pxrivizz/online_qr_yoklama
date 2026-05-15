# QR Attend

QR Attend, ders yoklamasını QR kodu, konum doğrulama ve rol bazlı ekranlarla yöneten bir sistemdir. Proje üç parçadan oluşur:

- `backend`: Express tabanlı API
- `web`: Admin, öğretmen ve öğrenci için web arayüzü
- `mobile`: Öğrenciler için Flutter uygulaması

## Genel Akış

1. Kullanıcı giriş yapar.
2. Öğretmen veya admin ders ve yoklama oturumu oluşturur.
3. Oturum aktifken QR kod üretilir ve öğrenci bunu tarar.
4. Mobil uygulama, QR kodu ve konumu doğrulayıp yoklamayı gönderir.
5. Web arayüzünde ders, oturum ve katılım bilgileri görüntülenir ve yönetilir.

## Web Sayfaları

Web uygulaması rol bazlı çalışır. Bazı sayfalar sadece admin veya öğretmene, bazıları sadece öğrenciye açıktır.

### 1. Giriş Sayfası

`/login`

- Sisteme giriş yapılan ekrandır.
- E-posta ve şifre ile oturum açılır.
- Rolüne göre kullanıcı ilgili panoya yönlendirilir.
- Demo hesap bilgileri ekranda gösterilir.

### 2. Ana Panel

`/dashboard`

- Admin ve öğretmenler için ana özet sayfasıdır.
- Toplam ders, aktif oturum ve günlük yoklama gibi genel bilgileri gösterir.
- Ders kartları üzerinden ilgili derse geçiş yapılabilir.
- Aktif oturum varsa QR kod açma ve oturum yönetme işlemleri bu ekrandan yapılabilir.

### 3. Dersler Sayfası

`/courses`

- Tüm derslerin listelendiği yönetim ekranıdır.
- Yeni ders ekleme, mevcut dersi güncelleme ve silme işlemleri yapılır.
- Ders için ağ, konum ve planlanan oturum sayısı gibi ayarlar tanımlanabilir.

### 4. Ders Detay Sayfası

`/courses/:id`

- Tek bir dersin tüm detaylarını gösterir.
- Öğrenci listesi, yoklama geçmişi ve katılım tablosu bulunur.
- QR tabanlı yoklama başlatma ve sonlandırma yapılabilir.
- Excel ile içe/dışa aktarma işlemleri desteklenir.
- Manuel yoklama ekleme ve öğrencileri derse toplu aktarma akışları da bu sayfada yer alır.

### 5. Aktif Oturum Sayfası

`/sessions/:id`

- Devam eden bir yoklama oturumunun detay ekranıdır.
- QR kodu, süre sayacı ve mevcut katılımcılar gösterilir.
- Öğrenciler manuel olarak da yoklamaya eklenebilir.
- Oturum kapatma işlemi buradan yapılır.

### 6. Kullanıcılar Sayfası

`/users`

- Yalnızca admin için erişilebilen kullanıcı yönetim ekranıdır.
- Öğrenci ve öğretmen kullanıcıları listelenir.
- Yeni kullanıcı oluşturma, güncelleme, silme ve toplu işlemler yapılır.
- Excel ile öğrenci toplu ekleme ve toplu silme akışları desteklenir.

### 7. Benim Yoklamam

`/my-attendance`

- Öğrencinin kendi katılım özetini gösteren sayfadır.
- Ders bazında devam oranı, katıldığı ders sayısı ve devamsızlık bilgileri yer alır.
- Rapor indirme alanı bulunur.

### 8. Öğrenci Paneli

`/student/dashboard`

- Öğrenci için mobil uyumlu ana ekrandır.
- Açık yoklama oturumu varsa uyarı gösterir ve QR taramaya yönlendirir.
- Öğrencinin kayıtlı dersleri ve katılım yüzdeleri listelenir.
- Profil fotoğrafı eksikse uyarı banner’ı gösterilir.

### 9. QR Tarama Sayfası

`/student/scan`

- Öğrencinin kamera ile QR kod okuttuğu ekrandır.
- Tarama sonrası konum bilgisi alınır ve yoklama isteği gönderilir.
- Başarı veya hata durumları ekranda geri bildirim olarak gösterilir.

### 10. Profil Sayfası

`/student/profile`

- Öğrencinin profil bilgilerini gösterir.
- Profil fotoğrafı yükleme ve değiştirme işlemi yapılır.
- Ad soyad, öğrenci numarası ve e-posta bilgileri listelenir.

### 11. Öğretmen Paneli

`/teacher/dashboard`

- Öğretmenler için sadeleştirilmiş paneldir.
- Ders listesi ve aktif yoklamalar gösterilir.
- Dersten yoklama başlatma, QR gösterme ve oturum bitirme işlemleri burada yapılır.

## Mobil Uygulama Sayfaları

Flutter uygulaması öğrencilerin yoklamaya hızlı katılması için tasarlanmıştır.

### 1. Giriş Ekranı

`/login`

- Öğrencinin giriş yaptığı ekrandır.
- Oturum açıldıktan sonra kullanıcı otomatik olarak ana ekrana yönlendirilir.

### 2. Ana Ekran

`/dashboard`

- Öğrencinin derslerini ve açık yoklamaları gösterir.
- Açık bir yoklama varsa doğrudan tarama ekranına geçiş yapılabilir.
- Profil fotoğrafı durumu ve ders bazlı bilgiler de burada görünür.

### 3. QR Tarayıcı

`/scanner?courseId=...`

- Kamerayı kullanarak QR kod okur.
- QR okunduktan sonra konum bilgisiyle birlikte yoklama isteği gönderir.
- Başarılı işlem sonrası kullanıcı ana sayfaya döner.

### 4. Yoklama Ekranı

`/attendance?courseId=...`

- İlgili dersin yoklama durumunu gösteren ekrandır.
- Oturum ve katılım akışına bağlı detaylar burada görüntülenir.

## Backend Kısa Not

`backend` klasörü API servislerini içerir. Temel alanlar:

- kimlik doğrulama
- kullanıcı yönetimi
- ders yönetimi
- oturum ve QR üretimi
- katılım kayıtları
- içe/dışa aktarma işlemleri

## Çalıştırma

### Backend

```bash
cd backend
npm install
npm run dev
```

### Web

```bash
cd web
npm install
npm run dev
```

### Mobile

```bash
cd mobile
flutter pub get
flutter run
```

## Notlar

- Web uygulaması rol bazlıdır; bazı sayfalara sadece ilgili yetkiye sahip kullanıcılar erişebilir.
- Mobil uygulama QR tarama ve konum doğrulama ile yoklama alır.
- Uygulama ayarları ve API adresleri için ilgili ortam değişkenleri ve config dosyaları kontrol edilmelidir.