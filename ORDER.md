# مستندات جامع ماژول سفارشات (Order Module API Specification)

این مستند تشریح‌کننده کامل معماری، قوانین بیزینس، اندپوینت‌ها، فرمت درخواست و پاسخ و خطاهای ماژول سفارشات (فروشگاه هوشمند الکتریک) با متد پرداخت کارت به کارت می‌باشد.

---

## ۱. قوانین کلیدی بیزینس (Business Rules)
1. **روش پرداخت:** تنها روش پرداخت فعال `CARD_TO_CARD` (کارت به کارت) است.
2. **هزینه ارسال:** هزینه پست هنگام تحویل بسته به مامور پست پرداخت می‌شود؛ بنابراین `shippingPrice` همیشه 0 و `totalPrice = itemsPrice` است.
3. **محاسبه قیمت در سرور (اسنپ‌شات):** قیمت‌های ارسالی از کلاینت به هیچ وجه خوانده نمی‌شوند. قیمت واحد هر کالا بر اساس `(discountPrice ?? price)` کالا در دیتابیس در لحظه ثبت سفارش اسنپ‌شات می‌شود.
4. **رزرو و بازگردانی موجودی:** موجودی کالاها در زمان ثبت سفارش به صورت اتمیک در ترنزکشن رزرو (کسر) شده و در صورت لغو سفارش به موجودی انبار بازگردانده می‌شود.
5. **شناسه سفارش (`orderNumber`):** با پیشوند `SE-` و ۸ کاراکتر از الفبای ۳۲ تایی بدون ابهام (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`) با `crypto` تولید می‌شود.
6. **اسنپ‌شات آدرس:** مقادیر `receiverName`, `receiverPhone`, `province`, `city`, `addressLine`, `postalCode` مستقیماً روی رکورد سفارش ذخیره می‌شوند.
7. **محرمانگی یادداشت ادمین (`adminNote`):** فیلد `adminNote` هرگز در هیچ پاسخی به خریدار بازگردانده نمی‌شود.
8. **امنیت فیش واریزی:** فیش‌ها در پوشه خصوصی `storage/receipts/` نگهداری شده و فقط با بایت‌های جادویی معتبر (JPEG, PNG, WebP) و حداکثر ۵ مگابایت پذیرفته می‌شوند.

---

## ۲. جدول اندپوینت‌ها

| متد | مسیر | دسترسی | شرح |
| :--- | :--- | :--- | :--- |
| `GET` | `/payment-info` | خریدار / ادمین | دریافت شماره کارت و اطلاعات حساب فروشگاه |
| `POST` | `/orders` | خریدار | ثبت سفارش جدید و رزرو موجودی |
| `GET` | `/orders/my` | خریدار | لیست سفارش‌های خریدار جاری (صفحه‌بندی‌شده) |
| `GET` | `/orders/:id` | خریدار (مالک) | مشاهده جزئیات سفارش خریدار |
| `POST` | `/orders/:id/receipt` | خریدار (مالک) | آپلود تصویر فیش واریزی کارت به کارت |
| `GET` | `/orders/:id/receipt` | خریدار (مالک) | استریم تصویر فیش واریزی |
| `POST` | `/orders/:id/cancel` | خریدار (مالک) | لغو سفارش در وضعیت معلق و بازگردانی موجودی |
| `GET` | `/admin/orders` | فقط ادمین | لیست سفارش‌ها با فیلتر، جستجو و مشخصات کاربر |
| `GET` | `/admin/orders/:id` | فقط ادمین | جزئیات کامل سفارش شامل `adminNote` |
| `PATCH` | `/admin/orders/:id/payment` | فقط ادمین | تایید یا رد فیش واریزی (`approve` / `reject`) |
| `PATCH` | `/admin/orders/:id/status` | فقط ادمین | تغییر وضعیت سفارش (`CONFIRMED -> SHIPPED -> DELIVERED`) |
| `POST` | `/admin/orders/:id/cancel` | فقط ادمین | لغو سفارش توسط ادمین و بازگردانی موجودی |
| `GET` | `/admin/orders/:id/receipt` | فقط ادمین | استریم تصویر فیش واریزی در پنل ادمین |

---

## ۳. جزئیات اندپوینت‌های خریدار (Customer Endpoints)

### ۳.۱ دریافت اطلاعات کارت فروشگاه (`GET /payment-info`)
- **احراز هویت:** اجباری (کوکی `access_token` یا Bearer JWT)
- **پاسخ موفق (200 OK):**
```json
{
  "cardNumber": "6037997123456789",
  "cardHolder": "شرکت هوشمند الکتریک",
  "bankName": "بانک ملی ایران"
}
```
- **خطاها:**
  - `401 Unauthorized`: کاربر وارد نشده باشد.
  - `500 Internal Server Error`: کلیدهای `SHOP_CARD_NUMBER` یا `SHOP_CARD_HOLDER` در تنظیمات سرور موجود نباشند.

---

### ۳.۲ ثبت سفارش جدید (`POST /orders`)
- **احراز هویت:** اجباری
- **بدنه درخواست (JSON):**
```json
{
  "addressId": 1,
  "paymentMethod": "CARD_TO_CARD",
  "items": [
    { "productId": 10, "quantity": 2 },
    { "productId": 20, "quantity": 1 }
  ],
  "note": "لطفاً بعد از ساعت ۱۴ تحویل دهید"
}
```
- **پاسخ موفق (201 Created):**
```json
{
  "id": 1,
  "userId": 100,
  "orderNumber": "SE-9K3P2M8X",
  "status": "PENDING",
  "paymentMethod": "CARD_TO_CARD",
  "paymentStatus": "PENDING",
  "receiptUrl": null,
  "itemsPrice": 320000,
  "shippingPrice": 0,
  "totalPrice": 320000,
  "receiverName": "علی محمدی",
  "receiverPhone": "09123456789",
  "province": "تهران",
  "city": "تهران",
  "addressLine": "خیابان لاله زار جنوبی پلاک ۱۰",
  "postalCode": "1234567890",
  "note": "لطفاً بعد از ساعت ۱۴ تحویل دهید",
  "trackingCode": null,
  "createdAt": "2026-11-08T08:00:00.000Z",
  "updatedAt": "2026-11-08T08:00:00.000Z",
  "paidAt": null,
  "items": [
    {
      "id": 1,
      "productId": 10,
      "title": "کلید دوپل مینیاتوری",
      "price": 120000,
      "quantity": 2
    },
    {
      "id": 2,
      "productId": 20,
      "title": "پریز برق ارت دار",
      "price": 80000,
      "quantity": 1
    }
  ]
}
```
- **خطاها:**
  - `400 Bad Request`: ورودی نامعتبر، اقلام تکراری، تعداد نامعتبر (بیش از ۲۰ یا کمتر از ۱)، محصول ناموجود/غیرفعال، دسته‌بندی غیرفعال.
  - `401 Unauthorized`: کاربر وارد نشده باشد.
  - `404 Not Found`: آدرس یافت نشود یا متعلق به خریدار نباشد.
  - `409 Conflict`: عدم کفایت موجودی انبار کالا یا داشتن ۳ سفارش در انتظار پرداخت (قانون ضد سوءاستفاده).

---

### ۳.۳ لیست سفارش‌های من (`GET /orders/my`)
- **احراز هویت:** اجباری
- **پارامترهای Query:**
  - `page`: شماره صفحه (اختیاری، پیش‌فرض: 1، حداقل: 1)
  - `limit`: تعداد در هر صفحه (اختیاری، پیش‌فرض: 10، حداقل: 1، حداکثر: 50)
- **پاسخ موفق (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "orderNumber": "SE-9K3P2M8X",
      "status": "PENDING",
      "paymentMethod": "CARD_TO_CARD",
      "paymentStatus": "PENDING",
      "itemsPrice": 320000,
      "shippingPrice": 0,
      "totalPrice": 320000,
      "items": [ ... ],
      "createdAt": "2026-11-08T08:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### ۳.۴ جزئیات سفارش خریدار (`GET /orders/:id`)
- **احراز هویت:** اجباری
- **پاسخ موفق (200 OK):** جزئیات سفارش همراه با اسنپ‌شات آدرس و اقلام بدون `adminNote`.
- **خطاها:**
  - `404 Not Found`: سفارش یافت نشود یا متعلق به کاربر نباشد (جلوگیری از افشای شناسه‌ها).

---

### ۳.۵ آپلود فیش واریزی (`POST /orders/:id/receipt`)
- **احراز هویت:** اجباری (مالک سفارش)
- **Content-Type:** `multipart/form-data`
- **فیلد فایل:** `receipt` (تصویر JPEG, PNG یا WebP، حداکثر ۵ مگابایت)
- **پاسخ موفق (200 OK):** رکورد سفارش با وضعیت `paymentStatus: "WAITING_REVIEW"` و مقداردهی `receiptUrl`.
- **خطاها:**
  - `400 Bad Request`: فایل ارسال نشده باشد، حجم بیش از ۵ مگابایت باشد یا بایت‌های جادویی نامعتبر باشند.
  - `404 Not Found`: سفارش وجود نداشته باشد یا متعلق به خریدار نباشد.
  - `409 Conflict`: وضعیت سفارش PENDING نباشد، یا وضعیت پرداخت قبلاً WAITING_REVIEW یا PAID باشد.

---

### ۳.۶ لغو سفارش توسط خریدار (`POST /orders/:id/cancel`)
- **احراز هویت:** اجباری (مالک سفارش)
- **شرط اجرا:** فقط برای سفارش‌های در وضعیت `status: PENDING` و در صورتی که پرداخت نشده باشد (`paymentStatus !== PAID`).
- **پاسخ موفق (200 OK):** وضعیت سفارش به `CANCELLED` تغییر کرده و موجودی کالاها به انبار بازگردانده می‌شود.
- **خطاها:**
  - `404 Not Found`: سفارش یافت نشود یا متعلق به خریدار نباشد.
  - `409 Conflict`: سفارش قبلاً لغو شده باشد (عدم بازگردانی مضاعف موجودی)، وضعیت PENDING نباشد، یا سفارش پرداخت شده باشد.

---

## ۴. جزئیات اندپوینت‌های پنل مدیریت (Admin Endpoints)

کلیه روت‌های زیر نیازمند لاگین با نقش `ADMIN` هستند (`@Roles(Role.ADMIN)`). کاربر غیر ادمین خطای `403 Forbidden` دریافت می‌کند.

### ۴.۱ لیست سفارش‌ها (`GET /admin/orders`)
- **پارامترهای Query:**
  - `status`: فیلتر وضعیت سفارش (`PENDING`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED`)
  - `paymentStatus`: فیلتر وضعیت پرداخت (`PENDING`, `WAITING_REVIEW`, `PAID`, `FAILED`)
  - `search`: جستجو در شماره سفارش (`orderNumber`) یا شماره تماس گیرنده (`receiverPhone`)
  - `dateFrom`: تاریخ شروع به فرمت ISO8601 (`YYYY-MM-DDTHH:mm:ssZ`)
  - `dateTo`: تاریخ پایان به فرمت ISO8601
  - `page`: شماره صفحه (پیش‌فرض: 1)
  - `limit`: تعداد در صفحه (پیش‌فرض: 10، حداکثر: 50)
- **پاسخ موفق (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "orderNumber": "SE-9K3P2M8X",
      "status": "PENDING",
      "paymentStatus": "WAITING_REVIEW",
      "adminNote": "یادداشت داخلی",
      "user": {
        "id": 100,
        "name": "علی محمدی",
        "phone": "09123456789"
      },
      "items": [ ... ]
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### ۴.۲ جزئیات کامل سفارش ادمین (`GET /admin/orders/:id`)
- **پاسخ موفق (200 OK):** شامل تمام فیلدهای سفارش از جمله `adminNote`، اقلام و اطلاعات خریدار.

---

### ۴.۳ تایید یا رد پرداخت (`PATCH /admin/orders/:id/payment`)
- **شرط اجرا:** فقط زمانی که `paymentStatus === WAITING_REVIEW` باشد.
- **بدنه درخواست (JSON):**
```json
{
  "action": "approve", // یا "reject"
  "adminNote": "فیش تایید شد"
}
```
- **منطق عملیات:**
  - `approve`:
    - `paymentStatus` $\rightarrow$ `PAID`
    - `paidAt` $\rightarrow$ زمان جاری سرور (`now`)
    - `status` $\rightarrow$ `CONFIRMED`
  - `reject`:
    - `paymentStatus` $\rightarrow$ `FAILED` (خریدار می‌تواند فیش جدید آپلود کند)

---

### ۴.۴ تغییر وضعیت پردازش سفارش (`PATCH /admin/orders/:id/status`)
- **نقشه صریح انتقالات مجاز:**
  - `CONFIRMED` $\rightarrow$ `SHIPPED` (الزاماً نیازمند `paymentStatus: PAID` است؛ فیلد `trackingCode` پستی ذخیره می‌شود)
  - `SHIPPED` $\rightarrow$ `DELIVERED`
- **بدنه درخواست (JSON):**
```json
{
  "status": "SHIPPED",
  "trackingCode": "19876543210123456789",
  "adminNote": "تحویل باجه مرکزی پست گردید"
}
```
- **خطاها:**
  - `409 Conflict`: انتقال وضعیت غیرمجاز، یا انتقال به `SHIPPED` در حالی که وضعیت پرداخت `PAID` نباشد.

---

### ۴.۵ لغو سفارش توسط ادمین (`POST /admin/orders/:id/cancel`)
- **شرط اجرا:** هر سفارشی که هنوز `DELIVERED` یا `CANCELLED` نشده باشد.
- **بدنه درخواست (JSON - اختیاری):**
```json
{
  "adminNote": "لغو بنا به درخواست تلفنی خریدار"
}
```
- **منطق عملیات:**
  - وضعیت سفارش به `CANCELLED` تغییر می‌یابد.
  - موجودی انبار برای تک‌تک اقلام سفارش در ترنزکشن بازگردانده می‌شود.
  - در صورتی که سفارش قبلاً پرداخت شده بوده (`paymentStatus: PAID`)، یادداشت سیستمی استرداد وجه دستی به `adminNote` اضافه می‌شود:
    `[سفارش پرداخت‌شده لغو گردید - نیاز به استرداد وجه دستی به مشتری]`.
  - لغو دوباره سفارش لغوشده خطای `409 Conflict` می‌دهد.

