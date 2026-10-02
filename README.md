# Ulugbek Payent

Paynet to'lov tizimi uchun Node.js Express service. Hozircha MLBB va PUBG uchun moslangan.

## Ishga tushirish

1. Paketlarni o'rnating:

```bash
npm install
```

2. `.env.example` asosida `.env` yarating.

`GW_API_KEY` ga GW Ultimate API kalitini yozing.
GW API so'rovlari server allowlist'i bilan mos ishlashi uchun majburan IPv4
orqali yuboriladi.

3. Development server:

```bash
npm run dev
```

Paketlarni birinchi marta MongoDBga yozish uchun:

```bash
npm run seed:packages
```

4. Production:

```bash
npm start
```

## Endpointlar

- `GET /` - service status
- `GET /health` - health check
- `POST /api/paynet/mlbb` - MLBB Paynet JSON-RPC endpoint
- `POST /api/paynet/pubg` - PUBG Paynet JSON-RPC endpoint

## Paynet metodlari

Har ikkala game endpoint quyidagi JSON-RPC metodlarni qo'llaydi:

- `GetInformation`
- `PerformTransaction`
- `CheckTransaction`
- `GetStatement`

Auth: `Authorization: Basic base64(login:password)`

## Telegram admin bot

`.env` ichida `ADMIN_IDS` ga admin Telegram user IDlarini yozing.

Bot menyusi:

- `📦 MLBB paketlar` - MLBB paketlarini ko'rish
- `📦 PUBG paketlar` - PUBG paketlarini ko'rish
- `➕ MLBB paket` - yangi MLBB paket qo'shish
- `➕ PUBG paket` - yangi PUBG paket qo'shish
- `🔎 Order qidirish` - `#1`, `#2` kabi tartib raqam orqali order topish
- `💰 Balans` - GW API balansini faqat raqam ko'rinishida ko'rsatish
- `🌐 GW MLBB katalog` - API'dagi faqat Global MLBB paket nomi va narxi
- `🌐 GW PUBG katalog` - API'dagi faqat Global PUBG UC paket nomi va narxi

Har bir paket uchun inline tugmalar:

- `Narx` - paket narxini o'zgartirish
- `GW paket` - jonli API katalogidan mos top-up mahsulotini tugma orqali tanlash
- `O'chirish/Yoqish` - paketni vaqtincha active/inactive qilish
- `Delete` - paketni bazadan o'chirish

Paynet faqat `isActive: true` bo'lgan paketlarni qabul qiladi.
Top-up ishlashi uchun paket GW katalogidan yaratiladi. Admin yangi paket
yaratishda jonli GW mahsulotini tanlaydi, so'ng mijoz Paynet orqali to'laydigan
sotuv narxini so'mda kiritadi. Paket miqdori, nomi, API narxi va PID avtomatik
saqlanadi. Tranzaksiyada mijozdan GW API narxi emas, admin belgilagan sotuv narxi
yechiladi. Eski paketdagi GW mahsulotini `🔗 GW paket` tugmasi orqali almashtirish
mumkin.

## GW Ultimate top-up

`PerformTransaction` quyidagi oqimda ishlaydi:

1. Paynet summa va paket tekshiriladi.
2. Paynet `transactionId` qiymati idempotent `trxid` sifatida `POST /orders` ga yuboriladi.
3. GW javobi (`processing`, `completed`, `cancelled`) lokal orderga saqlanadi.
4. `CheckTransaction` paytida `processing` order `GET /orders/:orderId` orqali yangilanadi.

PUBG uchun `userId` sifatida `player_id`, MLBB uchun `userId` va `zoneId`
yuboriladi. GW API xatolari lokal orderdagi `gwError` va `gwResponse` maydonlarida
saqlanadi.

PUBG `GetInformation` so'rovida Player ID GW API `POST /pubgvvfy` orqali
tekshiriladi va javobdagi o'yinchi nomi `fields.player_name` sifatida qaytariladi.
Bu tekshiruv GW tarifiga ko'ra balansdan alohida haq yechishi mumkin. MLBB
ma'lumot tekshiruvi avvalgidek Smile.one orqali ishlaydi.

## Order raqami

Har bir orderda MongoDB `_id` bilan birga `orderNumber` ham bo'ladi. Bu raqam `1` dan boshlanadi va Telegram xabarda `Order: #1` ko'rinishida chiqadi. Muammo bo'lgan orderni botdagi `🔎 Order qidirish` orqali shu raqam bilan topish mumkin.

## MLBB GetInformation namunasi

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "GetInformation",
  "params": {
    "serviceId": 3,
    "fields": {
      "user_id": "12345678",
      "zone_id": "1234",
      "quantity": "55"
    }
  }
}
```

## MLBB PerformTransaction namunasi

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "PerformTransaction",
  "params": {
    "serviceId": 3,
    "transactionId": "paynet-transaction-1",
    "amount": 1500000,
    "fields": {
      "user_id": "12345678",
      "zone_id": "1234",
      "quantity": "55"
    }
  }
}
```

## PUBG GetInformation namunasi

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "GetInformation",
  "params": {
    "serviceId": 4,
    "fields": {
      "player_id": "5123456789",
      "quantity": "60"
    }
  }
}
```

## PUBG PerformTransaction namunasi

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "PerformTransaction",
  "params": {
    "serviceId": 4,
    "transactionId": "paynet-transaction-2",
    "amount": 1400000,
    "fields": {
      "player_id": "5123456789",
      "quantity": "60"
    }
  }
}
```

## Eslatma

Paynet `amount` qiymatini tiyin formatida yuboradi. Masalan, 15 000 so'm uchun `1500000` yuborilishi kerak.
