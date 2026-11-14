# مستند جامع معماری، اسکیما و قرارداد API بک‌ند (Backend Specification for Frontend AI)

این سند راهنمای رسمی و جامع برای هوش مصنوعی فرانت‌اند (Frontend AI) و توسعه‌دهندگان رابط کاربری است. تمام جزئیات اسکیما، قوانین بیزینس، روت‌های HTTP، متدها، ساختار ریکوئست و ریسپانس، و رفتارهای سرور به دقت در این فایل ثبت شده است تا فرانت‌اند و بک‌ند در نهایت هماهنگی کار کنند و هیچ‌گونه کم‌کاری یا اضافه‌کاری رخ ندهد.

---

## ۱. اصول و پروتکل‌های کلی ارتباط فرانت‌اند و بک‌ند

۱. **ارسال کوکی‌ها و احراز هویت (بسیار مهم):**
   - احراز هویت با کوکی‌های امن `httpOnly` انجام می‌شود (`accessToken` و `refreshToken`).
   - در تمامی درخواست‌های شبکه (Axios / Fetch) در فرانت‌اند **الزاماً** باید تنظیم `withCredentials: true` (در Axios) یا `credentials: 'include'` (در Fetch) فعال باشد؛ در غیر این صورت کاربر احراز هویت نشده و با خطای `401 Unauthorized` مواجه می‌شود.
۲. **قانون ممنوعیت ارسال فیلدهای ناشناس (`forbidNonWhitelisted: true`):**
   - بک‌ند دارای اعتبارسنجی سراسری سخت‌گیرانه است. هر فیلدی که در بدنه ریکوئست (Body) ارسال شود و در قرارداد مجاز نباشد (مانند `id`, `userId`, `createdAt`, `updatedAt`, `user`, `totalPrice` و...) بلافاصله باعث خطای **`400 Bad Request`** می‌شود. فقط و فقط فیلدهای مجاز اعلام‌شده را بفرستید.
۳. **محاسبات مالی و قیمت‌گذاری در سرور (Server-Side Pricing):**
   - قیمت کالاها، تخفیف‌ها و جمع فاکتور هرگز از فرانت‌اند خوانده نمی‌شوند. تمامی مبالغ به صورت عدد صحیح به **تومان** در سرور از روی دیتابیس اسنپ‌شات و محاسبه می‌شوند.
۴. **تبدیل اعداد فارسی و فرمت شماره موبایل:**
   - شماره موبایل‌ها ۱۱ رقمی و با فرمت `/^09\d{9}$/` هستند. فرانت‌اند باید قبل از ارسال، ارقام فارسی/عربی کیبورد کاربر (`۰۱۲۳۴۵۶۷۸۹`) را به ارقام انگلیسی تبدیل و فاصله‌ها را Trim کند.
۵. **کدهای وضعیت استاندارد HTTP:**
   - `200 OK`: عملیات دریافت یا به‌روزرسانی موفق.
   - `201 Created`: ثبت موفق منبع جدید (سفارش، محصول، دیدگاه و...).
   - `400 Bad Request`: ورودی نامعتبر فرمت، عدم تطابق Regex، طول نامعتبر یا ارسال فیلدهای غیرمجاز.
   - `401 Unauthorized`: کاربر لاگین نیست یا نشست منقضی شده است.
   - `403 Forbidden`: کاربر لاگین است ولی دسترسی به روت‌های ادمین ندارد (`role !== 'ADMIN'`).
   - `404 Not Found`: منبع یافت نشد (برای حفظ حریم خصوصی، منابع سایر کاربران نیز ۴۰۴ برمی‌گردانند، نه ۴۰۳).
   - `409 Conflict`: تداخل وضعیت در بیزینس لاجیک (مثلاً اتمام موجودی انبار، لغو مجدد سفارش لغوشده، حذف محصول ثبت‌شده در سفارشات قبلی).
   - `429 Too Many Requests`: عبور از سقف مجاز تلاش (Rate Limit).

---

## ۲. مدل‌ها، اسکیماهای دیتابیس و اندپوینت‌های متناظر

---

### ۱. ماژول کاربران و احراز هویت (`User`, `Otp`, `RefreshToken`)

#### اسکیمای Prisma:
```prisma
enum Role {
  CUSTOMER
  ADMIN
}

model User {
  id            Int            @id @default(autoincrement())
  phone         String         @unique @db.VarChar(11)
  name          String         @db.VarChar(100)
  role          Role           @default(CUSTOMER)
  isActive      Boolean        @default(true)
  refreshTokens RefreshToken[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  orders          Order[]
  addresses       Address[]
  contactMessages ContactMessage[]
  comments        Comment[]
  discountUsages  DiscountUsage[]
}

model Otp {
  id        Int       @id @default(autoincrement())
  phone     String    @db.VarChar(11)
  codeHash  String    @db.VarChar(255)
  expiresAt DateTime
  attempts  Int       @default(0)
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([phone])
}

model RefreshToken {
  id        Int       @id @default(autoincrement())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    Int
  tokenHash String    @unique @db.VarChar(255)
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}
```

#### اندپوینت‌های احراز هویت (`/auth`):
- `POST /auth/request-otp`
  - **دسترسی:** عمومی (`@Public()`)
  - **Body:** `{ "phone": "09123456789" }`
  - **پاسخ (200 OK):** `{ "message": "کد تایید ارسال شد", "expiresIn": 120 }`
- `POST /auth/verify-otp`
  - **دسترسی:** عمومی (`@Public()`)
  - **Body:** `{ "phone": "09123456789", "code": "12345", "name": "نام کاربر" }` (فیلد `name` در اولین ثبت‌نام الزامی است)
  - **رفتار:** کوکی‌های `accessToken` و `refreshToken` به صورت `httpOnly` ست می‌شوند.
  - **پاسخ (200 OK):** `{ "message": "ورود موفقیت‌آمیز بود", "user": { "id": 1, "name": "...", "phone": "09123456789", "role": "CUSTOMER" } }`
- `GET /auth/me`
  - **دسترسی:** احراز هویت شده (کوکی لاگین)
  - **پاسخ (200 OK):** `{ "id": 1, "name": "...", "phone": "...", "role": "CUSTOMER" | "ADMIN" }`
- `POST /auth/refresh`
  - **دسترسی:** عمومی (کوکی `refreshToken` خوانده می‌شود)
  - **پاسخ (200 OK):** تمدید خودکار توکن‌ها و بازگرداندن `{ "message": "توکن با موفقیت تمدید شد" }`.
- `POST /auth/logout`
  - **دسترسی:** عمومی / لاگین‌شده
  - **رفتار:** پاک‌سازی کوکی‌های احراز هویت در مرورگر.
  - **پاسخ (200 OK):** `{ "message": "خروج با موفقیت انجام شد" }`

---

### ۲. ماژول دسته‌بندی‌ها (`Category`)

#### اسکیمای Prisma:
```prisma
model Category {
  id              Int        @id @default(autoincrement())
  parent          Category?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: Restrict)
  parentId        Int?
  children        Category[] @relation("CategoryTree")
  name            String     @db.VarChar(100)
  slug            String     @unique @db.VarChar(120)
  description     String?    @db.Text
  image           String?    @db.VarChar(255)
  imageAlt        String?    @db.VarChar(150)
  metaTitle       String?    @db.VarChar(70)
  metaDescription String?    @db.VarChar(170)
  sortOrder       Int        @default(0)
  isActive        Boolean    @default(true)
  products        Product[]
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  @@index([parentId])
  @@index([isActive])
}
```

#### اندپوینت‌های عمومی ویترین (`/categories`):
- `GET /categories`
  - **دسترسی:** عمومی (`@Public()`)
  - **توضیحات:** لیست درخت دسته‌بندی‌های فعال (اگر والدی غیرفعال باشد، فرزندانش نیز بازگردانده نمی‌شوند).
  - **پاسخ (200 OK):** آرایه تخت از دسته‌ها شامل `parent: { id, name }`.
- `GET /categories/slug/:slug`
  - **دسترسی:** عمومی (`@Public()`)
  - **توضیحات:** دریافت جزئیات یک دسته فعال بر اساس اسلاگ یکتا جهت صفحات سئو (در صورت غیرفعال بودن خطای ۴۰۴ صادر می‌شود).
- `GET /categories/:id`
  - **دسترسی:** عمومی (`@Public()`)
  - **توضیحات:** دریافت جزئیات یک دسته فعال بر اساس شناسه عددی (اگر غیرفعال باشد ۴۰۴ می‌دهد).

#### اندپوینت‌های پنل مدیریت (`/admin/categories` و `/categories` با نقش ادمین):
- `GET /admin/categories`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **توضیحات:** لیست تمام دسته‌ها شامل دسته‌های فعال و غیرفعال جهت نمایش در جدول پنل و سلکت‌های والد.
- `GET /admin/categories/:id`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **توضیحات:** جزئیات کامل دسته حتی در صورت غیرفعال بودن.
- `POST /categories`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **Body (JSON):**
    ```json
    {
      "name": "کلید و پریز",
      "slug": "switches-sockets",
      "parentId": null,
      "description": "انواع کلید و پریز مدرن",
      "image": "https://...",
      "imageAlt": "تصویر کلید و پریز",
      "sortOrder": 0,
      "metaTitle": "خرید کلید و پریز",
      "metaDescription": "بهترین کلید و پریزهای ایرانی و خارجی",
      "isActive": true
    }
    ```
  - **پاسخ (201 Created):** آبجکت دسته ایجاد شده.
- `PATCH /categories/:id`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **Body (JSON):** تمامی فیلدهای ایجاد به صورت اختیاری.
  - **پاسخ (200 OK):** آبجکت دسته ویرایش شده.
- `DELETE /categories/:id`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **قانون ایمنی:** در صورتی که دسته دارای کالا یا زیردسته باشد، اجازه حذف داده نمی‌شود و خطای `409 Conflict` می‌دهد.
  - **پاسخ (200 OK):** `{ "message": "Category deleted" }`

---

### ۳. ماژول برندها (`Brand`)

#### اسکیمای Prisma:
```prisma
model Brand {
  id              Int        @id @default(autoincrement())
  name            String     @db.VarChar(100)
  slug            String     @unique @db.VarChar(120)
  logo            String?    @db.VarChar(255)
  description     String?    @db.Text
  metaTitle       String?    @db.VarChar(70)
  metaDescription String?    @db.VarChar(170)
  isActive        Boolean    @default(true)
  products        Product[]
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  @@index([isActive])
}
```

#### اندپوینت‌های ویترین و مدیریت برندها (`/brands` و `/admin/brands`):
- `GET /brands`
  - **دسترسی:** عمومی (`@Public()`)
  - **توضیحات:** لیست برندهای فعال همراه با لوگو جهت نمایش در اسلایدر صفحه اصلی و فیلترهای سایدبار کاتالوگ.
- `GET /brands/slug/:slug`
  - **دسترسی:** عمومی (`@Public()`)
  - **توضیحات:** دریافت اطلاعات یک برند فعال به همراه محصولات آن برای لندینگ پیج اختصاصی برند.
- `GET /admin/brands`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **توضیحات:** لیست تمام برندها (فعال و غیرفعال) برای جدول مدیریت ادمین.
- `POST /admin/brands` (یا `POST /brands`)
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **Body (JSON):**
    ```json
    {
      "name": "دلند الکتریک",
      "slug": "deland",
      "logo": "https://...",
      "description": "تولیدکننده تجهیزات برقی ساختمانی",
      "metaTitle": "محصولات دلند الکتریک",
      "metaDescription": "خرید انواع کلید و پریز دلند با گارانتی معتبر",
      "isActive": true
    }
    ```
- `PATCH /admin/brands/:id`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **Body (JSON):** فیلدهای ویرایشی برند یا سوئیچ وضعیت `isActive`.
- `DELETE /admin/brands/:id`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **رفتار دیتابیس (`onDelete: SetNull`):** حذف برند کالاهای آن را پاک نمی‌کند، بلکه `brandId` محصولات به `null` تبدیل می‌شود.

---

### ۴. ماژول محصولات و تصاویر (`Product`, `ProductImage`)

#### اسکیمای Prisma:
```prisma
model Product {
  id              Int            @id @default(autoincrement())
  category        Category       @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  categoryId      Int
  brand           Brand?         @relation(fields: [brandId], references: [id], onDelete: SetNull)
  brandId         Int?
  title           String         @db.VarChar(200)
  slug            String         @unique @db.VarChar(220)
  description     String?        @db.Text
  specs           Json?
  metaTitle       String?        @db.VarChar(70)
  metaDescription String?        @db.VarChar(170)
  price           Int
  discountPrice   Int?
  stock           Int            @default(0)
  sku             String?        @unique @db.VarChar(50)
  isActive        Boolean        @default(true)
  images          ProductImage[]
  orderItems      OrderItem[]
  comments        Comment[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([categoryId, isActive])
  @@index([brandId])
  @@index([isActive])
}

model ProductImage {
  id        Int      @id @default(autoincrement())
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId Int
  url       String   @db.VarChar(255)
  alt       String?  @db.VarChar(200)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  @@index([productId])
}
```

#### اندپوینت‌های عمومی ویترین (`/product`):
- `GET /product`
  - **دسترسی:** عمومی (`@Public()`)
  - **پارامترهای اختیاری کوئری:**
    - `page` (شماره صفحه، پیش‌فرض ۱)
    - `limit` (تعداد در هر صفحه، حداکثر ۵۰، پیش‌فرض ۱۰)
    - `categoryId` (فیلتر شناسه دسته‌بندی)
    - `brandId` (فیلتر شناسه برند)
    - `search` (جستجوی متن عنوان کالا، غیرحساس به حروف کوچک و بزرگ)
    - `sort`: یکی از مقادیر `newest` (جدیدترین)، `price_asc` (ارزان‌ترین)، `price_desc` (گران‌ترین)
  - **ساختار پاسخ (دو حالت):**
    - ۱. اگر **هیچ پارامتری ارسال نشود** (سازگاری به عقب): آرایه تخت `Product[]`.
    - ۲. اگر **هر یک از پارامترها ارسال شود**: پاسخ ساختاریافته‌ی زیر:
      ```json
      {
        "items": [
          {
            "id": 1,
            "title": "کلید دوپل آسیا",
            "slug": "asia-2-switch",
            "price": 180000,
            "discountPrice": 150000,
            "stock": 12,
            "sku": "SKU-1001",
            "isActive": true,
            "category": { "id": 2, "name": "کلید و پریز" },
            "brand": { "id": 1, "name": "آسیا الکتریک", "slug": "asia" },
            "images": [{ "id": 1, "url": "https://...", "alt": "..." }]
          }
        ],
        "total": 35,
        "page": 1,
        "limit": 10
      }
      ```
  - **قوانین پالایش:** فقط محصولات فعال (`isActive: true`) که دسته‌بندی آن‌ها نیز فعال است برگردانده می‌شوند.
- `GET /product/slug/:slug`
  - **دسترسی:** عمومی (`@Public()`)
  - **توضیحات:** دریافت جزئیات محصول فعال برای صفحه محصول سئو (اگر کالا یا دسته‌اش غیرفعال باشد، خطای ۴۰۴ می‌دهد).
- `GET /product/:id`
  - **دسترسی:** عمومی (`@Public()`)
  - **توضیحات:** دریافت جزئیات با شناسه عددی (اگر غیرفعال باشد، ۴۰۴ می‌دهد).

#### اندپوینت‌های پنل مدیریت (`/admin/product` یا `/admin/products` و `/product` با نقش ادمین):
- `GET /admin/products` (یا `GET /admin/product`)
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **توضیحات:** لیست تمام محصولات سیستم (شامل کالاهای فعال و غیرفعال).
- `GET /admin/products/:id`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **توضیحات:** جزئیات کامل محصول بدون فیلتر فعال بودن.
- `POST /product`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **Body (JSON):**
    ```json
    {
      "title": "کلید دوپل مینیاتوری",
      "slug": "mini-switch-2",
      "categoryId": 2,
      "brandId": 1,
      "price": 200000,
      "discountPrice": 170000,
      "stock": 25,
      "sku": "MINI-02",
      "description": "توضیحات فنی کامل کالا",
      "specs": { "ولتاژ": "۲۲۰ ولت", "جریان": "۱۰ آمپر", "گارانتی": "۲۴ ماه" },
      "metaTitle": "خرید کلید دوپل",
      "metaDescription": "بهترین کلید دوپل بازار",
      "isActive": true
    }
    ```
  - **اعتبارسنجی‌ها:** قیمت تخفیف باید اکیداً کمتر از قیمت اصلی باشد (`discountPrice < price`)، یکتا بودن `slug` و `sku`.
  - **پاسخ (201 Created):** آبجکت محصول ایجاد شده.
- `PATCH /product/:id`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **Body (JSON):** فیلدهای اختیاری ویرایشی یا تغییر سوئیچ `isActive`.
- `DELETE /product/:id`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **قانون عدم حذف سفارشات قبلی:** اگر کالا در سفارش‌های گذشته خریداران ثبت شده باشد، بک‌ند به جهت حفظ سوابق مالی خطای `409 Conflict` می‌دهد. فرانت‌اند در این حالت باید به ادمین پیشنهاد دهد به جای حذف، فیلد `isActive: false` را اعمال کند.

---

### ۵. ماژول آدرس‌های تحویل مشتری (`Address`)

#### اسکیمای Prisma:
```prisma
model Address {
  id            Int      @id @default(autoincrement())
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId        Int
  title         String   @db.VarChar(50)
  receiverName  String   @db.VarChar(100)
  receiverPhone String   @db.VarChar(15)
  province      String   @db.VarChar(50)
  city          String   @db.VarChar(50)
  addressLine   String   @db.Text
  postalCode    String   @db.VarChar(10)
  isDefault     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userId])
}
```

#### اندپوینت‌های خریدار (`/addresses`):
- کلیه مسیرها با کوکی لاگین مشتری کار می‌کنند و `userId` از توکن استخراج می‌شود.
- سقف هر کاربر: حداکثر ۱۰ آدرس (ثبت آدرس یازدهم خطای `409 Conflict` می‌دهد).
- اولین آدرس کاربر خودکار پیش‌فرض می‌شود.
- `GET /addresses`
  - **پاسخ (200 OK):** آرایه‌ای از آدرس‌های کاربر جاری (آدرس پیش‌فرض اول، سپس جدیدترین‌ها). فیلد `userId` در خروجی حذف شده است.
- `POST /addresses`
  - **Body (JSON):**
    ```json
    {
      "title": "منزل",
      "receiverName": "علی محمدی",
      "receiverPhone": "09123456789",
      "province": "تهران",
      "city": "تهران",
      "addressLine": "خیابان لاله زار جنوبی کوچه بوشهری پلاک ۵ واحد ۲",
      "postalCode": "1234567890"
    }
    ```
  - **اعتبارسنجی‌ها:** کد پستی دقیقاً ۱۰ رقم، شماره گیرنده با فرمت `/^09\d{9}$/`.
  - **پاسخ (201 Created):** رکورد آدرس ایجاد شده.
- `GET /addresses/:id`
  - **پاسخ (200 OK):** اطلاعات آدرس. اگر آدرس متعلق به کاربر نباشد، خطای `404 Not Found` بازگردانده می‌شود.
- `PATCH /addresses/:id`
  - **Body (JSON):** ویرایش فیلدهای آدرس.
- `PATCH /addresses/:id/default`
  - **توضیحات:** تبدیل این آدرس به آدرس پیش‌فرض کاربر در یک ترنزکشن اتمیک.
- `DELETE /addresses/:id`
  - **توضیحات:** حذف آدرس. در صورت حذف آدرس پیش‌فرض، جدیدترین آدرس باقی‌مانده کاربر به صورت خودکار پیش‌فرض می‌شود.

---

### ۶. ماژول سفارشات و پرداخت کارت به کارت (`Order`, `OrderItem`)

#### اسکیمای Prisma:
```prisma
enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}

enum PaymentMethod {
  COD
  CARD_TO_CARD
}

enum PaymentStatus {
  PENDING
  WAITING_REVIEW
  PAID
  FAILED
}

model Order {
  id             Int            @id @default(autoincrement())
  user           User           @relation(fields: [userId], references: [id], onDelete: Restrict)
  userId         Int
  orderNumber    String         @unique @db.VarChar(20)
  status         OrderStatus    @default(PENDING)
  paymentMethod  PaymentMethod
  paymentStatus  PaymentStatus  @default(PENDING)
  receiptUrl     String?        @db.VarChar(255)
  itemsPrice     Int
  shippingPrice  Int            @default(0)
  discountAmount Int            @default(0)
  totalPrice     Int
  receiverName   String         @db.VarChar(100)
  receiverPhone  String         @db.VarChar(15)
  province       String         @db.VarChar(50)
  city           String         @db.VarChar(50)
  addressLine    String         @db.Text
  postalCode     String         @db.VarChar(10)
  note           String?        @db.Text
  trackingCode   String?        @db.VarChar(50)
  adminNote      String?        @db.Text
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  paidAt         DateTime?

  discountCode   DiscountCode?  @relation(fields: [discountCodeId], references: [id], onDelete: SetNull)
  discountCodeId Int?
  discountUsage  DiscountUsage?

  items          OrderItem[]
  
  @@index([userId])
  @@index([status])
  @@index([paymentStatus])
  @@index([createdAt])
  @@index([discountCodeId])
}

model OrderItem {
  id        Int     @id @default(autoincrement())
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId   Int
  product   Product @relation(fields: [productId], references: [id], onDelete: Restrict)
  productId Int
  title     String  @db.VarChar(200)
  price     Int
  quantity  Int

  @@index([orderId])
  @@index([productId])
}
```

#### بیزینس لاجیک‌های کلیدی سفارشات:
۱. **تنها روش پرداخت فعال `CARD_TO_CARD` است.**
۲. **هزینه ارسال (`shippingPrice`) همیشه ۰ تومان است** (پست پس‌کرایه است و خریدار در محل به مامور پست پرداخت می‌کند). بنابراین `totalPrice = itemsPrice - discountAmount`.
۳. **امنیت فیش واریزی:** فیش‌ها در پوشه خصوصی خارج از وب ذخیره می‌شوند و فقط از طریق اندپوینت استریم امن با هدر `Cache-Control: private, no-store` سرو می‌شوند.
۴. **رزرو موجودی در ثبت و بازگردانی در لغو:** هنگام ایجاد سفارش موجودی کالاها در ترنزکشن کسر می‌شود. در صورت لغو سفارش (توسط مشتری یا ادمین) موجودی کالاها دقیقاً یک بار بازمی‌گردد.
۵. **محرمانگی یادداشت ادمین (`adminNote`):** این فیلد هرگز در پاسخ‌های خریدار فرانت‌اند ظاهر نمی‌شود.

#### اندپوینت‌های خریدار:
- `GET /payment-info`
  - **دسترسی:** لاگین‌شده
  - **پاسخ (200 OK):** `{ "cardNumber": "6037...", "cardHolder": "نام صاحب حساب", "bankName": "بانک ملی" }`
- `POST /orders`
  - **دسترسی:** لاگین‌شده
  - **Body (JSON):**
    ```json
    {
      "addressId": 1,
      "paymentMethod": "CARD_TO_CARD",
      "items": [
        { "productId": 10, "quantity": 2 },
        { "productId": 12, "quantity": 1 }
      ],
      "note": "لطفاً بعد از ساعت ۱۴ ارسال شود"
    }
    ```
  - **پاسخ (201 Created):** آبجکت امن سفارش شامل `orderNumber` (مثلاً `SE-8K2P9M4X`).
  - **خطاها:** ۴۰۰ برای کالای غیرفعال/نامعتبر، ۴۰۹ برای اتمام موجودی انبار یا داشتن بیش از ۳ سفارش معلق پرداخت.
- `GET /orders/my`
  - **دسترسی:** خریدار
  - **Query:** `page=1&limit=10`
  - **پاسخ (200 OK):**
    ```json
    {
      "items": [ /* آرایه سفارش‌های کاربر بدون adminNote */ ],
      "total": 4,
      "page": 1,
      "limit": 10
    }
    ```
- `GET /orders/:id`
  - **دسترسی:** مالک سفارش (اگر سفارش دیگری باشد، خطای ۴۰۴ می‌دهد).
- `POST /orders/:id/receipt`
  - **دسترسی:** مالک سفارش (فقط در وضعیت PENDING و وضعیت پرداخت PENDING یا FAILED)
  - **Content-Type:** `multipart/form-data`
  - **فیلد فایل:** `receipt` (تصویر JPEG, PNG, WebP حداکثر ۵ مگابایت)
  - **پاسخ (200 OK):** تغییر وضعیت پرداخت به `WAITING_REVIEW`.
- `GET /orders/:id/receipt`
  - **دسترسی:** مالک سفارش (استریم مستقیم عکس با احراز هویت کوکی).
- `POST /orders/:id/cancel`
  - **دسترسی:** مالک سفارش (فقط در وضعیت PENDING و در صورتی که پرداخت نشده باشد).
  - **پاسخ (200 OK):** لغو سفارش و بازگرداندن آنی موجودی اقلام به انبار.

#### اندپوینت‌های پنل مدیریت (`/admin/orders`):
- `GET /admin/orders`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **Query:** `page`, `limit`, `status`, `paymentStatus`, `search`, `dateFrom`, `dateTo`
  - **پاسخ (200 OK):**
    ```json
    {
      "items": [
        {
          "id": 1,
          "orderNumber": "SE-...",
          "status": "PENDING",
          "paymentStatus": "WAITING_REVIEW",
          "hasReceipt": true,
          "totalPrice": 320000,
          "receiverName": "علی محمدی",
          "receiverPhone": "0912...",
          "user": { "id": 10, "name": "...", "phone": "..." },
          "items": [ ... ]
        }
      ],
      "total": 12,
      "page": 1,
      "limit": 10
    }
    ```
- `GET /admin/orders/:id`
  - **پاسخ (200 OK):** جزئیات کامل سفارش به همراه `adminNote` و اطلاعات خریدار.
- `GET /admin/orders/:id/receipt`
  - **توضیحات:** استریم فیش واریزی در پنل ادمین.
- `PATCH /admin/orders/:id/payment`
  - **Body (JSON):**
    ```json
    {
      "action": "approve", // یا "reject"
      "adminNote": "فیش تایید شد" // حداکثر ۵۰۰ کاراکتر
    }
    ```
  - در حالت `approve`: وضعیت پرداخت `PAID`، زمان `paidAt` ثبت و وضعیت سفارش `CONFIRMED` می‌شود.
- `PATCH /admin/orders/:id/status`
  - **Body (JSON):**
    ```json
    {
      "status": "SHIPPED", // نقشه مجاز: CONFIRMED -> SHIPPED -> DELIVERED
      "trackingCode": "1234567890", // برای SHIPPED
      "adminNote": "تحویل باجه مرکزی پست شد"
    }
    ```
  - انتقال به `SHIPPED` نیازمند وضعیت پرداخت `PAID` است.
- `POST /admin/orders/:id/cancel`
  - **Body (JSON):** `{ "adminNote": "لغو بنا به تماس مشتری" }`
  - لغو سفارش و بازگردانی موجودی انبار. اگر سفارش پرداخت‌شده باشد یادداشت نیاز به استرداد وجه دستی درج می‌شود.

---

### ۷. ماژول تماس با ما (`ContactMessage`)

#### اسکیمای Prisma:
```prisma
enum ContactSubject {
  ORDER_ISSUE
  PAYMENT_ISSUE
  PRODUCT_QUESTION
  DELIVERY_ISSUE
  OTHER
}

enum ContactStatus {
  NEW
  IN_PROGRESS
  DONE
}

model ContactMessage {
  id        Int            @id @default(autoincrement())
  fullName  String         @db.VarChar(100)
  phone     String         @db.VarChar(11)
  subject   ContactSubject
  message   String         @db.Text
  status    ContactStatus  @default(NEW)
  adminNote String?        @db.Text
  user      User?          @relation(fields: [userId], references: [id], onDelete: SetNull)
  userId    Int?
  ipHash    String?        @db.VarChar(64)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  @@index([status, createdAt])
  @@index([phone])
  @@index([userId])
  @@index([ipHash, createdAt])
}
```

#### اندپوینت‌های تماس با ما:
- `POST /contact`
  - **دسترسی:** عمومی (`@Public()`) با پشتیبانی از احراز هویت اختیاری (اگر لاگین باشد `userId` ثبت می‌شود).
  - **Body (JSON):**
    ```json
    {
      "fullName": "نام و نام خانوادگی",
      "phone": "09123456789",
      "subject": "ORDER_ISSUE",
      "message": "متن پیام حداقل ۱۰ کاراکتر...",
      "website": ""
    }
    ```
  - **فیلد تله ربات (`website`):** برای انسان خالی است؛ در صورت پر شدن توسط ربات، سرور بدون ذخیره در دیتابیس پیام موفقیت جعلی می‌دهد.
  - **محدودیت نرخ (Rate Limit):** حداکثر ۳ پیام در ساعت از یک IP یا تلفن (خطای ۴۲۹).
  - **پاسخ (201 Created):** `{ "message": "Received" }`
- `GET /admin/contact`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **Query:** `page`, `limit`, `status`, `subject`, `search`, `dateFrom`, `dateTo`
  - **پاسخ (200 OK):** `{ "items": [...], "total": 10, "page": 1, "limit": 20, "counts": { "NEW": 5, "IN_PROGRESS": 3, "DONE": 2 } }`
- `GET /admin/contact/:id`
  - **پاسخ (200 OK):** جزئیات پیام به همراه مشخصات کاربر و `adminNote`.
- `PATCH /admin/contact/:id`
  - **Body (JSON):** `{ "status": "IN_PROGRESS", "adminNote": "تماس گرفته شد" }`
- `DELETE /admin/contact/:id`
  - **پاسخ (200 OK):** `{ "message": "Deleted" }`

---

### ۸. ماژول دیدگاه‌ها و امتیازدهی به محصولات (`Comment`)

#### اسکیمای Prisma:
```prisma
enum CommentStatus {
  PENDING
  APPROVED
  REJECTED
}

model Comment {
  id            Int           @id @default(autoincrement())
  product       Product       @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId     Int
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId        Int
  title         String?       @db.VarChar(100)
  text          String        @db.Text
  rating        Int           @default(5)
  status        CommentStatus @default(PENDING)
  isRecommended Boolean?
  isBuyer       Boolean       @default(false)
  adminReply    String?       @db.Text
  adminReplyAt  DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([productId, status])
  @@index([userId])
  @@index([status, createdAt])
}
```

#### اندپوینت‌های دیدگاه‌ها:
- `GET /comments/product/:productId`
  - **دسترسی:** عمومی (`@Public()`)
  - **توضیحات:** لیست نظرات تاییدشده (`status === 'APPROVED'`) برای تب نظرات در صفحه کالا.
  - **پاسخ (200 OK):**
    ```json
    [
      {
        "id": 1,
        "title": "کیفیت ساخت عالی",
        "text": "نصب بسیار راحتی داشت و رنگش کاملاً مات و قشنگه.",
        "rating": 5,
        "isRecommended": true,
        "isBuyer": true,
        "adminReply": "با تشکر از اعتماد شما به هوشمند الکتریک.",
        "adminReplyAt": "2026-11-09T10:00:00.000Z",
        "createdAt": "2026-11-08T14:00:00.000Z",
        "user": { "name": "رضا ک." }
      }
    ]
    ```
- `POST /comments/product/:productId`
  - **دسترسی:** لاگین‌شده
  - **Body (JSON):**
    ```json
    {
      "title": "کیفیت عالی",
      "text": "متن دیدگاه من حداقل ۵ کاراکتر...",
      "rating": 5,
      "isRecommended": true
    }
    ```
  - **پاسخ (201 Created):** نظر با وضعیت پیش‌فرض `PENDING` ثبت می‌شود تا پس از تایید ادمین نمایش یابد. سرور خودکار چک می‌کند که آیا کاربر این کالا را در گذشته خریده تا مقدار `isBuyer` را تنظیم کند.
- `GET /admin/comments`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **Query:** `page`, `limit`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `productId`
- `PATCH /admin/comments/:id/status`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **Body (JSON):** `{ "status": "APPROVED" | "REJECTED" }`
- `PATCH /admin/comments/:id/reply`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **Body (JSON):** `{ "adminReply": "متن پاسخ رسمی مدیریت فروشگاه" }`
- `DELETE /admin/comments/:id`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)

---

### ۹. ماژول کدهای تخفیف و کوپن‌ها (`DiscountCode`, `DiscountUsage`)

#### اسکیمای Prisma:
```prisma
enum DiscountType {
  PERCENTAGE
  FIXED_AMOUNT
}

model DiscountCode {
  id                Int             @id @default(autoincrement())
  code              String          @unique @db.VarChar(50)
  type              DiscountType    @default(PERCENTAGE)
  value             Int
  maxDiscountAmount Int?
  minOrderAmount    Int?            @default(0)
  usageLimit        Int?
  usageCount        Int             @default(0)
  userLimit         Int             @default(1)
  startDate         DateTime?
  endDate           DateTime?
  isActive          Boolean         @default(true)
  description       String?         @db.VarChar(255)
  orders            Order[]
  usages            DiscountUsage[]
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([code, isActive])
  @@index([isActive, endDate])
}

model DiscountUsage {
  id             Int          @id @default(autoincrement())
  discountCode   DiscountCode @relation(fields: [discountCodeId], references: [id], onDelete: Cascade)
  discountCodeId Int
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId         Int
  order          Order        @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId        Int          @unique
  discountAmount Int
  createdAt      DateTime     @default(now())

  @@unique([discountCodeId, orderId])
  @@index([discountCodeId, userId])
  @@index([userId])
}
```

#### اندپوینت‌های کدهای تخفیف:
- `POST /discounts/validate`
  - **دسترسی:** لاگین‌شده (مشتری در سبد خرید یا صفحه تسویه‌حساب)
  - **Body (JSON):**
    ```json
    {
      "code": "YALDA1405",
      "cartAmount": 450000
    }
    ```
  - **پاسخ موفق (200 OK):**
    ```json
    {
      "valid": true,
      "code": "YALDA1405",
      "discountAmount": 50000,
      "finalAmount": 400000,
      "message": "کد تخفیف با موفقیت اعمال شد"
    }
    ```
  - **خطاها (400 / 409):** کد منقضی شده، حداقل مبلغ خرید رعایت نشده، سقف استفاده کاربر پر شده، کد غیرفعال.
- `GET /admin/discounts`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **توضیحات:** لیست تمام کدهای تخفیف و آمار تعداد دفعات استفاده شده (`usageCount` از `usageLimit`).
- `POST /admin/discounts`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **Body (JSON):**
    ```json
    {
      "code": "NOROOZ1405",
      "type": "PERCENTAGE", // یا "FIXED_AMOUNT"
      "value": 20,
      "maxDiscountAmount": 100000,
      "minOrderAmount": 300000,
      "usageLimit": 200,
      "userLimit": 1,
      "startDate": "2026-03-20T00:00:00.000Z",
      "endDate": "2026-04-05T23:59:59.000Z",
      "description": "تخفیف ویژه عید نوروز",
      "isActive": true
    }
    ```
- `PATCH /admin/discounts/:id`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)
  - **Body (JSON):** ویرایش مشخصات کد یا سوئیچ فعال/غیرفعال.
- `DELETE /admin/discounts/:id`
  - **دسترسی:** ادمین (`@Roles('ADMIN')`)

---

### ۱۰. ماژول آپلود امن فایل و رسانه‌ها (`POST /admin/uploads` و سرو استاتیک `/uploads/...`)

این ماژول برای مدیریت آپلود انواع فایل‌های تصویری در پنل ادمین (شامل تصاویر محصولات، بنر دسته‌بندی‌ها و لوگوی برندها) با رعایت استانداردهای امنیتی سطح بالا (Zero Trust) طراحی شده است.

#### اصول امنیتی و فرآیند دو مرحله‌ای (Two-Step Flow):
۱. **فرایند آپلود و ثبت مستقل هستند:**
   - کاربر ابتدا فایل تصویر را به اندپوینت `POST /admin/uploads` می‌فرستد.
   - سرور تصویر را پس از اعتبارسنجی امنیتی روی دیسک ذخیره کرده و پاسخ زیر را برمی‌گرداند:
     ```json
     {
       "path": "products/8c89c8a9-9529-4d6d-88b9-50989b53293e.png"
     }
     ```
   - سپس فرانت‌اند، همین مقدار `path` برگشتی را در فرم ایجاد/ویرایش محصول (`ProductImage.url`)، دسته (`Category.image`) یا برند (`Brand.logo`) قرار داده و درخواست نهایی را به صورت JSON ثبت می‌کند.
۲. **قانون Zero Trust (هیچ داده‌ای از سمت کلاینت معتبر نیست):**
   - **نام اصلی فایل دور ریخته می‌شود:** نام اصلی فایل برای جلوگیری از حملات Path Traversal یا تداخل نام‌ها کاملاً نادیده گرفته شده و نام فایل با یک UUID تصادفی (`crypto.randomUUID()`) همراه با پسوند واقعی جایگزین می‌شود.
   - **بررسی بایت‌های جادویی (Magic Bytes):** هدر `Content-Type` یا پسوند فرستاده‌شده از کلاینت چک نمی‌شود؛ بلکه بایت‌های اولیه بافر بررسی می‌شوند. فقط فرمت‌های PNG (`89 50 4E 47 0D 0A 1A 0A`)، JPEG (`FF D8 FF`) و WebP (`RIFF....WEBP`) مجاز هستند.
   - **تحریم و ممنوعیت کامل SVG:** فایل‌های وکتور SVG به دلیل ساختار متنی XML و احتمال تزریق کدهای مخرب جاوااسکریپت (حملات XSS)، مطلقاً پذیرفته نمی‌شوند و خطای `400 Bad Request` دریافت خواهند کرد.
   - **محدودیت حجم (۵ مگابایت):** در صورت ارسال فایلی با حجم بیش از ۵ مگابایت، بدون دریافت کامل استریم در دیسک، عملیات متوقف شده و خطای صریح `413 Payload Too Large` صادر می‌شود.
   - **جداسازی فولدرها (Whitelist Folders):** فیلد `type` فقط مقادیر `product` (ذخیره در `products/`)، `category` (ذخیره در `categories/`) و `brand` (ذخیره در `brands/`) را می‌پذیرد. هر مقدار دیگر با `400 Bad Request` رد می‌شود.

#### اندپوینت آپلود ادمین:
- `POST /admin/uploads`
  - **دسترسی:** فقط ادمین (`@Roles('ADMIN')` + کوکی احراز هویت `accessToken`)
  - **نوع فرم:** `multipart/form-data`
  - **فیلدهای فرم (Form Data):**
    - `file`: فایل باینری تصویر (الزامی، حداکثر ۵ مگابایت، فرمت PNG/JPG/WebP)
    - `type`: رشته، یکی از سه مقدار دقیق: `"product"` | `"category"` | `"brand"` (الزامی)
  - **هدرهای درخواست:**
    - `Content-Type: multipart/form-data`
    - کوکی `accessToken`
  - **پاسخ موفق (201 Created):**
    ```json
    {
      "path": "products/2fa85f64-5717-4562-b3fc-2c963f66afa6.png"
    }
    ```
  - **خطاهای احتمالی:**
    - `400 Bad Request`: عدم ارسال فایل، ارسال فرمت غیرمجاز (فایل متنی تقلبی یا SVG)، یا ارسال `type` نامعتبر/تلاش برای Traversal.
    - `401 Unauthorized`: عدم ارسال یا منقضی بودن کوکی `accessToken`.
    - `403 Forbidden`: کاربر جاری نقش `ADMIN` ندارد.
    - `413 Payload Too Large`: حجم فایل بیش از ۵ مگابایت است.

#### نحوه سرو و نمایش عمومی تصاویر (`/uploads/...`):
- تصاویر آپلودشده به صورت استاتیک از مسیر روت `/uploads/` در دسترس کلاینت‌ها هستند:
  - آدرس نمایش تصویر:
    `GET http://localhost:3000/uploads/products/2fa85f64-5717-4562-b3fc-2c963f66afa6.png`
  - **هدرهای امنیتی:** سرور هدر امنیتی `X-Content-Type-Options: nosniff` را بر روی تمام فایل‌های استاتیک ست می‌کند و قابلیت Directory Listing غیرفعال است (`index: false`).
  - **حریم خصوصی فیش‌های واریزی:** پوشه فیش‌های کارت به کارت (`private-uploads/receipts`) کاملاً خصوصی و تفکیک شده است و از روت `/uploads` در دسترس عموم نخواهد بود.

#### راهنمای پیاده‌سازی در کامپوننت‌های فرانت‌اند:
```typescript
// نمونه تابع آپلود در فرانت‌اند (React / Next.js)
async function uploadImage(file: File, type: 'product' | 'category' | 'brand'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  const response = await fetch('/api/admin/uploads', {
    method: 'POST',
    body: formData,
    credentials: 'include', // ارسال کوکی accessToken
  });

  if (response.status === 413) {
    throw new Error('حجم تصویر نباید بیشتر از ۵ مگابایت باشد');
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'خطا در آپلود تصویر');
  }

  const data = await response.json();
  return data.path; // مثلا: "products/uuid.png"
}
```

---

## ۳. دستورالعمل و چک‌لیست طلایی هوش مصنوعی فرانت‌اند

1. **انتقال دقیق به فرانت‌اند:** این فایل را در مسیر دلخواه پروژه فرانت قرار دهید تا هوش مصنوعی بر اساس روت‌ها و تایپ‌های بالا کامپوننت‌ها را ایجاد کند.
2. **عدم اختراع فیلدهای خارج از اسکیما:** فرانت‌اند نباید فیلدهای ساختگی بفرستد (مانند `discountPercentage` یا `userName` در ثبت سفارش) زیرا بک‌ند آنها را رد می‌کند.
3. **حفظ استایل و دیزاین سیستم:** در تمام صفحات از قالب راست‌چین (RTL)، تایپوگرافی تمیز فارسی و سیستم رنگی هماهنگ با هویت بصری «هوشمند الکتریک» استفاده شود.

