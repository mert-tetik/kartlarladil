export const legalContent: Record<
  "tr" | "en",
  Record<"terms" | "privacy" | "refund" | "cookies" | "subscriptions", string>
> = {
  tr: {
    terms: `
<h2>1. Giriş ve Kabul</h2>
<p>Bu Kullanım Koşulları ("Koşullar"), Mert Tetik ("biz", "bize", "bizim") tarafından işletilen FoxiesDeck web uygulaması ve hizmetlerinin ("Hizmet") kullanımını düzenler. Hizmete erişerek veya kullanarak bu Koşulları okuduğunu, anladığını ve bağlı olduğunu kabul etmiş olursun. Bu Koşulları kabul etmiyorsan, lütfen Hizmeti kullanma.</p>

<h2>2. Hizmet Tanımı</h2>
<p>FoxiesDeck, kullanıcıların çok dilli kelime haznesini koleksiyon kartları, quiz ve yapay zeka destekli pratik sohbetleri ile geliştirmesine olanak tanıyan bir öğrenme platformudur. Hizmet, ücretsiz ve ücretli abonelik planlarıyla sunulur.</p>

<h2>3. Kullanıcı Hesabı</h2>
<p>Hizmetin bazı özellikleri için hesap oluşturman gerekir. Kayıt sırasında doğru, güncel ve eksiksiz bilgi vermeyi kabul edersin. Hesap bilgilerinin gizliliğini korumak ve hesabın altındaki tüm faaliyetlerden sorumlu olmak sana aittir. Hesabının izinsiz kullanıldığını fark edersen derhal bizimle iletişime geçmelisin.</p>

<h2>4. Kabul Edilebilir Kullanım</h2>
<p>Hizmeti yalnızca yasal amaçlarla ve bu Koşullara uygun şekilde kullanabilirsin. Aşağıdaki eylemler yasaktır:</p>
<ul>
<li>Hizmeti aksatmak, zarar vermek veya yetkisiz erişim sağlamak amacıyla kullanmak;</li>
<li>Diğer kullanıcıların hesaplarına izinsiz erişmek;</li>
<li>İçeriği kopyalamak, dağıtmak veya tersine mühendislik yapmak;</li>
<li>Yasa dışı, zararlı, taciz edici veya başkalarının haklarını ihlal eden içerik paylaşmak.</li>
</ul>

<h2>5. Fikri Mülkiyet</h2>
<p>Hizmetteki tüm metin, grafik, logo, yazılım ve diğer materyaller bizim veya lisans verenlerimizin mülkiyetindedir ve fikri mülkiyet yasalarıyla korunur. Hizmeti kullanmak sana bu materyaller üzerinde herhangi bir mülkiyet hakkı vermez.</p>

<h2>6. Ücretlendirme ve Abonelikler</h2>
<p>Ücretli planlar aylık abonelik esasına göre faturalandırılır. Ödemeler LemonSqueezy ödeme işlemcisi üzerinden güvenli bir şekilde yapılır. Abonelik koşulları, yenileme, iptal ve plan değişiklikleri için lütfen <a href="/subscriptions">Abonelik Koşulları</a> sayfamızı incele.</p>

<h2>7. Sorumluluk Sınırlaması</h2>
<p>Hizmet "olduğu gibi" sunulur. Yürürlükteki yasanın izin verdiği ölçüde, Hizmetin kullanımından veya kullanılamamasından kaynaklanan dolaylı, arızi veya özel zararlardan sorumlu değiliz.</p>

<h2>8. Koşullardaki Değişiklikler</h2>
<p>Bu Koşulları zaman zaman güncelleyebiliriz. Önemli değişikliklerde kullanıcıları bilgilirmeye çalışırız. Hizmeti kullanmaya devam ederek güncellenmiş Koşulları kabul etmiş sayılırsın.</p>

<h2>9. Fesih</h2>
<p>Bu Koşulları ihlal etmen durumunda hesabını askıya alabilir veya sonlandırabiliriz. Ayrıca istediğin zaman hesabını silebilirsin.</p>

<h2>10. Uygulanacak Hukuk</h2>
<p>Bu Koşullar, Türkiye Kayseri yasalarına tabidir ve bu yasalara göre yorumlanır.</p>

<h2>11. İletişim</h2>
<p>Soruların için bizimle iletişime geç: <a href="mailto:foxiesdeck@outlook.com">foxiesdeck@outlook.com</a>.</p>
`,

    privacy: `
<h2>1. Giriş</h2>
<p>FoxiesDeck olarak gizliliğine saygı duyuyoruz. Bu Gizlilik Politikası, Hizmeti kullanırken hangi verileri topladığımızı, nasıl kullandığımızı ve haklarını nasıl koruduğumuzu açıklar.</p>

<h2>2. Toplanan Veriler</h2>
<p>Hizmeti sağlamak için aşağıdaki verileri toplayabiliriz:</p>
<ul>
<li><strong>Hesap bilgileri:</strong> e-posta adresi, görünen ad, şifre (hashlenmiş);</li>
<li><strong>Kullanım verileri:</strong> oluşturulan kartlar, quiz sonuçları, puanlar, rank ilerlemesi;</li>
<li><strong>Tercih verileri:</strong> arayüz dili, öğrenme dili, başlangıç seviyesi;</li>
<li><strong>AI pratik verileri:</strong> sohbet mesajları, çeviri istekleri (geçici işlenir, kalıcı saklanmaz);</li>
<li><strong>Teknik veriler:</strong> IP adresi, tarayıcı bilgisi, çerezler.</li>
</ul>

<h2>3. Veri Kullanım Amaçları</h2>
<p>Verilerini şu amaçlarla kullanırız:</p>
<ul>
<li>Hesabını oluşturmak ve yönetmek;</li>
<li>Öğrenme ilerlemeni takip etmek;</li>
<li>AI pratik özelliğini çalıştırmak;</li>
<li>Hizmeti güvenli ve istikrarlı tutmak;</li>
<li>Yasal yükümlülüklere uymak.</li>
</ul>

<h2>4. Üçüncü Taraflar</h2>
<p>Verilerin aşağıdaki güvenilir üçüncü taraflarla paylaşılabilir:</p>
<ul>
<li><strong>Supabase:</strong> kimlik doğrulama ve veri tabanı altyapısı;</li>
<li><strong>OpenAI:</strong> AI pratik sohbet ve çeviri yanıtları;</li>
<li><strong>LemonSqueezy:</strong> abonelik faturalandırma ve ödeme işlemleri;</li>
<li><strong>Vercel:</strong> uygulama barındırma.</li>
</ul>

<h2>5. Veri Saklama</h2>
<p>Hesabın aktif olduğu sürece verilerini saklarız. Hesabını sildiğinde, kişisel verilerin ve ilişkili ilerleme kayıtların makul bir süre içinde silinir. Yasa gerektirdiği durumlarda bazı veriler daha uzun süre saklanabilir.</p>

<h2>6. Güvenlik</h2>
<p>Verilerini korumak için endüstri standardı önlemler kullanıyoruz. Ancak internet üzerinden hiçbir veri iletiminin %100 güvenli olmadığını unutma.</p>

<h2>7. Kullanıcı Hakları</h2>
<p>Verilerinle ilgili olarak erişim, düzeltme, silme ve işlemeye itiraz etme haklarına sahip olabilirsin. Taleplerin için <a href="mailto:foxiesdeck@outlook.com">foxiesdeck@outlook.com</a> adresinden bize ulaşabilirsin.</p>

<h2>8. Çerezler</h2>
<p>Çerezler hakkında daha fazla bilgi için <a href="/cookies">Çerez Politikası</a> sayfamızı incele.</p>

<h2>9. İletişim</h2>
<p>Gizlilikle ilgili soruların için bizimle iletişime geç: <a href="mailto:foxiesdeck@outlook.com">foxiesdeck@outlook.com</a>.</p>
`,

    refund: `
<h2>1. Genel</h2>
<p>Bu İade Politikası, FoxiesDeck üzerinden satın alınan abonelikler için geçerlidir. Ödemeler LemonSqueezy ödeme işlemcisi aracılığıyla yapılır ve iade talepleri de bu politika çerçevesinde değerlendirilir.</p>

<h2>2. Abonelik İptali</h2>
<p>Aboneliğini istediğin zaman hesap ayarlarından veya LemonSqueezy müşteri portalından iptal edebilirsin. İptal işlemi, mevcut fatura döneminin sonunda geçerli olur. İptal edildikten sonra, o dönemin sonuna kadar ücretli özelliklere erişmeye devam edersin.</p>

<h2>3. İade Şartları</h2>
<p>Abonelik satın alındıktan sonra, mevcut fatura dönemi için kalan süre üzerinden iade yapılmaz. Abonelik iptali sonrası kalan günler için para iadesi yapılmaz. Teknik olarak Hizmetin uzun süre erişilemez olması gibi istisnai durumlarda iade talebinde bulunabilirsin.</p>

<h2>4. İade Süreci</h2>
<p>İade taleplerin için <a href="mailto:foxiesdeck@outlook.com">foxiesdeck@outlook.com</a> adresinden bize ulaş. Talepler LemonSqueezy platformu üzerinden işleme alınır ve genellikle 5-10 iş günü içinde değerlendirilir.</p>

<h2>5. İletişim</h2>
<p>İade ve ödeme konularında bizimle iletişime geç: <a href="mailto:foxiesdeck@outlook.com">foxiesdeck@outlook.com</a>.</p>
`,

    cookies: `
<h2>1. Çerez Nedir?</h2>
<p>Çerezler, ziyaret ettiğin web siteleri tarafından tarayıcına yerleştirilen küçük metin dosyalarıdır. Bu dosyalar, siteyi kullanırken tercihlerini hatırlamak ve deneyimini iyileştirmek için kullanılır.</p>

<h2>2. Kullanılan Çerezler</h2>
<p>FoxiesDeck şu çerezleri kullanır:</p>
<ul>
<li><strong>Dil tercihi çerezi:</strong> Seçtiğin arayüz dilini hatırlamak için kullanılır. Bu çerez, Hizmetin düzgün çalışması için gereklidir.</li>
</ul>

<h2>3. Üçüncü Taraf Çerezleri</h2>
<p>Şu anda analiz veya reklam amaçlı üçüncü taraf çerezleri kullanmıyoruz. Gelecekte analytics çerezi eklenirse bu sayfa güncellenecektir.</p>

<h2>4. Çerezleri Yönetme</h2>
<p>Tarayıcının ayarlarından çerezleri silebilir veya engelleyebilirsin. Ancak dil tercihi çerezini devre dışı bırakırsan, site her ziyaretinde dilini yeniden seçmen gerekebilir.</p>
`,

    subscriptions: `
<h2>1. Otomatik Yenileme</h2>
<p>Ücretli abonelikler aylık olarak otomatik yenilenir. Her fatura döneminin başlangıcında, kayıtlı ödeme yönteminizden tahsilat yapılır. LemonSqueezy ödeme işlemcisi bu süreci yönetir.</p>

<h2>2. Fatura Döngüsü</h2>
<p>Abonelik satın alma tarihinden itibaren 30 günlük fatura dönemleri geçerlidir. Her dönemin başında ücret tahsil edilir.</p>

<h2>3. İptal</h2>
<p>Aboneliğini istediğin zaman hesap ayarlarından veya LemonSqueezy müşteri portalından iptal edebilirsin. İptal, mevcut fatura döneminin sonunda geçerli olur; kalan süre için erişim devam eder ancak iade yapılmaz.</p>

<h2>4. Plan Değişiklikleri</h2>
<p>Daha yüksek bir plana yükseltme yaptığında, yükseltme anında geçerli olur ve mevcut dönemin kalan günleri için orantılı fark ücreti tahsil edilir. Daha düşük bir plana geçiş yaptığında, düşürme mevcut fatura döneminin sonunda geçerli olur.</p>

<h2>5. Fiyat Değişiklikleri</h2>
<p>Fiyatlarda değişiklik yapılması durumunda, değişiklik mevcut aboneliğin bir sonraki yenileme tarihinde geçerli olur. Kullanıcılar önemli fiyat değişikliklerinden önce bilgilendirilir.</p>

<h2>6. İletişim</h2>
<p>Abonelik konularında bizimle iletişime geç: <a href="mailto:foxiesdeck@outlook.com">foxiesdeck@outlook.com</a>.</p>
`,
  },

  en: {
    terms: `
<h2>1. Introduction and Acceptance</h2>
<p>These Terms of Service ("Terms") govern your use of the FoxiesDeck web application and services (the "Service") operated by Mert Tetik ("we", "us", "our"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, please do not use the Service.</p>

<h2>2. Description of Service</h2>
<p>FoxiesDeck is a language learning platform that helps users expand their multilingual vocabulary through collectible cards, quizzes, and AI-powered practice conversations. The Service is offered through free and paid subscription plans.</p>

<h2>3. User Account</h2>
<p>Some features require you to create an account. You agree to provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Contact us immediately if you suspect unauthorized use.</p>

<h2>4. Acceptable Use</h2>
<p>You may use the Service only for lawful purposes and in accordance with these Terms. The following is prohibited:</p>
<ul>
<li>Disrupting, damaging, or attempting to gain unauthorized access to the Service;</li>
<li>Accessing other users' accounts without permission;</li>
<li>Copying, distributing, or reverse-engineering any part of the Service;</li>
<li>Posting unlawful, harmful, harassing, or rights-infringing content.</li>
</ul>

<h2>5. Intellectual Property</h2>
<p>All text, graphics, logos, software, and other materials in the Service are owned by us or our licensors and protected by intellectual property laws. Using the Service does not give you ownership rights in these materials.</p>

<h2>6. Billing and Subscriptions</h2>
<p>Paid plans are billed on a monthly subscription basis. Payments are processed securely through LemonSqueezy. Please review our <a href="/subscriptions">Subscription Terms</a> for details on renewal, cancellation, and plan changes.</p>

<h2>7. Limitation of Liability</h2>
<p>The Service is provided "as is". To the extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of or inability to use the Service.</p>

<h2>8. Changes to Terms</h2>
<p>We may update these Terms from time to time. We will try to notify users of material changes. Continued use of the Service means you accept the updated Terms.</p>

<h2>9. Termination</h2>
<p>We may suspend or terminate your account if you violate these Terms. You may also delete your account at any time.</p>

<h2>10. Governing Law</h2>
<p>These Terms are governed by the laws of Türkiye Kayseri.</p>

<h2>11. Contact</h2>
<p>Contact us with questions at <a href="mailto:foxiesdeck@outlook.com">foxiesdeck@outlook.com</a>.</p>
`,

    privacy: `
<h2>1. Introduction</h2>
<p>At FoxiesDeck, we respect your privacy. This Privacy Policy explains what data we collect, how we use it, and how we protect your rights when you use the Service.</p>

<h2>2. Data We Collect</h2>
<p>To provide the Service, we may collect the following data:</p>
<ul>
<li><strong>Account information:</strong> email address, display name, password (hashed);</li>
<li><strong>Usage data:</strong> created cards, quiz results, points, rank progress;</li>
<li><strong>Preference data:</strong> interface language, learning language, starting tier;</li>
<li><strong>AI practice data:</strong> chat messages and translation requests (processed temporarily, not stored permanently);</li>
<li><strong>Technical data:</strong> IP address, browser information, cookies.</li>
</ul>

<h2>3. How We Use Data</h2>
<p>We use your data to:</p>
<ul>
<li>Create and manage your account;</li>
<li>Track your learning progress;</li>
<li>Operate the AI practice feature;</li>
<li>Keep the Service secure and stable;</li>
<li>Comply with legal obligations.</li>
</ul>

<h2>4. Third Parties</h2>
<p>Your data may be shared with the following trusted third parties:</p>
<ul>
<li><strong>Supabase:</strong> authentication and database infrastructure;</li>
<li><strong>OpenAI:</strong> AI practice chat and translation responses;</li>
<li><strong>LemonSqueezy:</strong> subscription billing and payment processing;</li>
<li><strong>Vercel:</strong> application hosting.</li>
</ul>

<h2>5. Data Retention</h2>
<p>We retain your data while your account is active. When you delete your account, personal data and associated progress records are removed within a reasonable period. Some data may be retained longer if required by law.</p>

<h2>6. Security</h2>
<p>We use industry-standard measures to protect your data. However, no transmission over the internet is 100% secure.</p>

<h2>7. Your Rights</h2>
<p>You may have rights to access, correct, delete, or object to the processing of your data. Contact us at <a href="mailto:foxiesdeck@outlook.com">foxiesdeck@outlook.com</a> for requests.</p>

<h2>8. Cookies</h2>
<p>For more information, see our <a href="/cookies">Cookie Policy</a>.</p>

<h2>9. Contact</h2>
<p>Contact us with privacy questions at <a href="mailto:foxiesdeck@outlook.com">foxiesdeck@outlook.com</a>.</p>
`,

    refund: `
<h2>1. General</h2>
<p>This Refund Policy applies to subscriptions purchased through FoxiesDeck. Payments are processed by LemonSqueezy, and refund requests are evaluated under this policy.</p>

<h2>2. Subscription Cancellation</h2>
<p>You may cancel your subscription at any time from your account settings or the LemonSqueezy customer portal. Cancellation takes effect at the end of the current billing period. You will continue to access paid features until the end of that period.</p>

<h2>3. Refund Conditions</h2>
<p>After a subscription is purchased, no refund is provided for the remaining time in the current billing period. No partial refunds are issued upon cancellation. Refunds may be considered only in exceptional cases, such as prolonged technical unavailability of the Service.</p>

<h2>4. Refund Process</h2>
<p>To request a refund, contact us at <a href="mailto:foxiesdeck@outlook.com">foxiesdeck@outlook.com</a>. Requests are processed through LemonSqueezy and typically reviewed within 5-10 business days.</p>

<h2>5. Contact</h2>
<p>Contact us with refund and billing questions at <a href="mailto:foxiesdeck@outlook.com">foxiesdeck@outlook.com</a>.</p>
`,

    cookies: `
<h2>1. What Are Cookies?</h2>
<p>Cookies are small text files placed on your browser by websites you visit. They are used to remember your preferences and improve your experience.</p>

<h2>2. Cookies We Use</h2>
<p>FoxiesDeck uses the following cookies:</p>
<ul>
<li><strong>Language preference cookie:</strong> remembers your selected interface language. This cookie is necessary for the Service to function correctly.</li>
</ul>

<h2>3. Third-Party Cookies</h2>
<p>We do not currently use third-party cookies for analytics or advertising. If analytics cookies are added in the future, this page will be updated.</p>

<h2>4. Managing Cookies</h2>
<p>You can delete or block cookies through your browser settings. However, if you disable the language preference cookie, you may need to select your language again on each visit.</p>
`,

    subscriptions: `
<h2>1. Automatic Renewal</h2>
<p>Paid subscriptions automatically renew on a monthly basis. Payment is charged to your registered payment method at the start of each billing cycle. The process is managed by LemonSqueezy.</p>

<h2>2. Billing Cycle</h2>
<p>Billing cycles are 30 days, starting from the date of purchase. The fee is charged at the beginning of each cycle.</p>

<h2>3. Cancellation</h2>
<p>You may cancel your subscription at any time from your account settings or the LemonSqueezy customer portal. Cancellation takes effect at the end of the current billing period; access continues until then, but no refund is issued.</p>

<h2>4. Plan Changes</h2>
<p>Upgrades to a higher plan take effect immediately, and a prorated difference for the remaining days of the current cycle is charged. Downgrades to a lower plan take effect at the end of the current billing period.</p>

<h2>5. Price Changes</h2>
<p>If prices change, the new price applies at your next renewal date. Users will be notified of significant price changes in advance.</p>

<h2>6. Contact</h2>
<p>Contact us with subscription questions at <a href="mailto:foxiesdeck@outlook.com">foxiesdeck@outlook.com</a>.</p>
`,
  },
};

export const LEGAL_LAST_UPDATED = "2026-06-14";
