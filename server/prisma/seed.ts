/**
 * prisma/seed.ts — ShopLite
 *
 * Chạy:   npx prisma db seed
 * Reset:  npx prisma migrate reset (xóa + migrate lại + seed)
 *
 * SCHEMA yêu cầu tối thiểu — đảm bảo prisma/schema.prisma có đủ:
 *
 *   enum Role          { CUSTOMER ADMIN }
 *   enum OrderStatus   { PENDING PAID SHIPPED COMPLETED CANCELLED }
 *   enum PaymentStatus { COMPLETED FAILED REFUNDED }
 *   enum EmailTokenType{ VERIFY RESET }
 *
 * Sau khi thêm enum: npx prisma migrate dev --name add-enums && npx prisma generate
 *
 * PACKAGE cần có trong server/package.json (dependencies):
 *   bcrypt
 * (dev dependencies):
 *   @types/bcrypt  @types/node
 *
 * tsconfig.json cần có:
 *   "types": ["node"]   (hoặc bỏ trường types để TS tự tìm)
 */

// Không import crypto để tránh xung đột tsconfig giữa prisma/ và src/.
// Dùng hàm tự viết — đủ cho mục đích seed (không cần cryptographic randomness).
function randomHex(bytes: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < bytes * 2; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

// Sinh idempotency key cố định từ string (đủ cho seed, KHÔNG dùng production).
function deterministicHash(input: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = (4294967296 * (2097151 & h2) + (h1 >>> 0));
  return Math.abs(combined).toString(16).padStart(16, '0').repeat(4).substring(0, 36);
}

// ─── Third-party ───────────────────────────────────────────────────────────────
// `bcrypt` (native), KHONG phai `bcryptjs`: Phase 2 da go bcryptjs di vi trung
// chuc nang. Hash cua hai package cung dinh dang $2b$ nen doi qua lai vo tu.
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// ─── Prisma enum — chỉ dùng string literal, tránh import enum bị lỗi ──────────
//
// LÝ DO không import { Role, OrderStatus, ... } từ @prisma/client:
//   Prisma chỉ export enum SAU KHI đã chạy "prisma generate".
//   Nếu schema chưa generate hoặc chưa có enum → import lỗi ngay lúc biên dịch.
//   Giải pháp: dùng string literal khớp với giá trị enum trong schema.
//   TypeScript vẫn kiểm tra type vì Prisma tự sinh union type cho từng field.
//
type Role           = 'CUSTOMER' | 'ADMIN';
type OrderStatus    = 'PENDING' | 'PAID' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
type PaymentStatus  = 'COMPLETED' | 'FAILED' | 'REFUNDED';
type EmailTokenType = 'VERIFY' | 'RESET';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10); // cost 10 cho seed nhanh; production dùng 12
}

/** Trả ngày trong quá khứ cách hiện tại n ngày. */
function daysAgo(n: number, offsetHours = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(d.getHours() - offsetHours);
  return d;
}

/** Sinh provider_txn_id giả. */
function fakeTxnId(): string {
  return `TXN_${randomHex(8).toUpperCase()}`;
}

/** Tính total_amount từ items — giống đúng logic service. */
function calcTotal(items: Array<{ unitPrice: Decimal; quantity: number }>): Decimal {
  return items.reduce(
    (sum, item) => sum.plus(item.unitPrice.times(item.quantity)),
    new Decimal(0),
  );
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const DEFAULT_PASSWORD = 'Webpx@2024';
const PLACEHOLDER_BASE = 'https://picsum.photos/seed';

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🌱 Bắt đầu seed ShopLite...\n');

  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

  // ═══════════════════════════════════════════
  // 1. USERS
  // ═══════════════════════════════════════════

  console.log('👥 Tạo users...');

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@shoplite.dev' },
    update: {},
    create: {
      email:         'admin@shoplite.dev',
      passwordHash:  hashedPassword,
      fullName:      'Admin ShopLite',
      role:          'ADMIN'    as Role,
      emailVerified: true,
      isActive:      true,
    },
  });

  const customerCong = await prisma.user.upsert({
    where:  { email: 'cong@webpx.vn' },
    update: {},
    create: {
      email:         'cong@webpx.vn',
      passwordHash:  hashedPassword,
      fullName:      'Bùi Thành Công',
      role:          'CUSTOMER' as Role,
      emailVerified: true,
      isActive:      true,
    },
  });

  const customerLan = await prisma.user.upsert({
    where:  { email: 'lan.nguyen@gmail.com' },
    update: {},
    create: {
      email:         'lan.nguyen@gmail.com',
      passwordHash:  hashedPassword,
      fullName:      'Nguyễn Thị Lan',
      role:          'CUSTOMER' as Role,
      emailVerified: true,
      isActive:      true,
    },
  });

  const customerDuc = await prisma.user.upsert({
    where:  { email: 'duc.tran@gmail.com' },
    update: {},
    create: {
      email:         'duc.tran@gmail.com',
      passwordHash:  hashedPassword,
      fullName:      'Trần Minh Đức',
      role:          'CUSTOMER' as Role,
      emailVerified: true,
      isActive:      true,
    },
  });

  // Chưa verify — test FR-A2 (chặn đặt hàng)
  const customerUnverified = await prisma.user.upsert({
    where:  { email: 'hanh.unverified@gmail.com' },
    update: {},
    create: {
      email:         'hanh.unverified@gmail.com',
      passwordHash:  hashedPassword,
      fullName:      'Phạm Hồng Hạnh',
      role:          'CUSTOMER' as Role,
      emailVerified: false,
      isActive:      true,
    },
  });

  // Bị khóa — test admin lock/unlock
  await prisma.user.upsert({
    where:  { email: 'locked.user@gmail.com' },
    update: {},
    create: {
      email:         'locked.user@gmail.com',
      passwordHash:  hashedPassword,
      fullName:      'Người Dùng Bị Khóa',
      role:          'CUSTOMER' as Role,
      emailVerified: true,
      isActive:      false,
    },
  });

  console.log(`   ✓ admin@shoplite.dev        (ADMIN)`);
  console.log(`   ✓ cong@webpx.vn             (CUSTOMER, verified)`);
  console.log(`   ✓ lan.nguyen@gmail.com       (CUSTOMER, verified)`);
  console.log(`   ✓ duc.tran@gmail.com         (CUSTOMER, verified)`);
  console.log(`   ✓ hanh.unverified@gmail.com  (CUSTOMER, chưa verify)`);
  console.log(`   ✓ locked.user@gmail.com      (CUSTOMER, bị khóa)\n`);

  // ═══════════════════════════════════════════
  // 2. EMAIL TOKEN
  // ═══════════════════════════════════════════
  //
  // Token cố định để test thủ công verify email mà không cần Mailtrap.
  // LƯU Ý: prisma.emailToken chỉ hoạt động nếu schema có model EmailToken.
  //   Nếu chưa có model này, xóa block bên dưới đi, seed vẫn chạy bình thường.

  const verifyTokenPlain = 'SEED_VERIFY_HANH_2024';
  const verifyTokenHash  = deterministicHash(verifyTokenPlain);

  // Kiểm tra model EmailToken có tồn tại không trước khi gọi
  // (tránh crash khi schema chưa có model này)
  const hasEmailTokenModel = 'emailToken' in prisma;

  if (hasEmailTokenModel) {
    const emailTokenClient = prisma as typeof prisma & {
      emailToken: {
        findUnique: (args: { where: { tokenHash: string } }) => Promise<{ id: string } | null>;
        create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
      };
    };

    const existingToken = await emailTokenClient.emailToken.findUnique({
      where: { tokenHash: verifyTokenHash },
    });

    if (!existingToken) {
      await emailTokenClient.emailToken.create({
        data: {
          userId:    customerUnverified.id,
          tokenHash: verifyTokenHash,
          type:      'VERIFY' as EmailTokenType,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 năm
        },
      });
    }
    console.log('📧 Email token verify (dùng test thủ công):');
    console.log(`   Token: ${verifyTokenPlain}`);
    console.log(`   POST /api/auth/verify-email  body: {"token":"${verifyTokenPlain}"}\n`);
  } else {
    console.log('⚠️  Model EmailToken chưa có trong schema — bỏ qua seed email token\n');
  }

  // ═══════════════════════════════════════════
  // 3. CATEGORIES — 2 cấp
  // ═══════════════════════════════════════════

  console.log('🗂️  Tạo categories...');

  type CatChild = { name: string; slug: string };
  type CatSeed  = { name: string; slug: string; children: CatChild[] };

  const categoryTree: CatSeed[] = [
    {
      name: 'Nhà bếp', slug: 'nha-bep',
      children: [
        { name: 'Dụng cụ nấu ăn',   slug: 'dung-cu-nau-an'   },
        { name: 'Đồ dùng bàn ăn',    slug: 'do-dung-ban-an'   },
        { name: 'Thiết bị nhà bếp',  slug: 'thiet-bi-nha-bep' },
      ],
    },
    {
      name: 'Phòng khách', slug: 'phong-khach',
      children: [
        { name: 'Nội thất phòng khách', slug: 'noi-that-phong-khach' },
        { name: 'Thảm & Rèm',           slug: 'tham-va-rem'          },
      ],
    },
    {
      name: 'Đèn & Chiếu sáng', slug: 'den-chieu-sang',
      children: [
        { name: 'Đèn trang trí', slug: 'den-trang-tri' },
        { name: 'Đèn chức năng', slug: 'den-chuc-nang' },
      ],
    },
    {
      name: 'Trang trí & Cây cảnh', slug: 'trang-tri-cay-canh',
      children: [
        { name: 'Chậu & Cây cảnh',  slug: 'chau-cay-canh'  },
        { name: 'Tranh & Đồng hồ',  slug: 'tranh-dong-ho'  },
        { name: 'Nến & Hương thơm', slug: 'nen-huong-thom' },
      ],
    },
  ];

  const categoryMap: Record<string, string> = {};

  for (const parent of categoryTree) {
    const parentCat = await prisma.category.upsert({
      where:  { slug: parent.slug },
      update: {},
      create: { name: parent.name, slug: parent.slug },
    });
    categoryMap[parent.slug] = parentCat.id;
    console.log(`   ✓ ${parent.name}`);

    for (const child of parent.children) {
      const childCat = await prisma.category.upsert({
        where:  { slug: child.slug },
        update: {},
        create: { name: child.name, slug: child.slug, parentId: parentCat.id },
      });
      categoryMap[child.slug] = childCat.id;
      console.log(`      └─ ${child.name}`);
    }
  }
  console.log();

  // ═══════════════════════════════════════════
  // 4. PRODUCTS — 26 sản phẩm
  // ═══════════════════════════════════════════

  console.log('📦 Tạo products...');

  type ProductSeed = {
    name:         string;
    slug:         string;
    categorySlug: string;
    price:        number;
    stock:        number;
    description:  string;
    deleted?:     boolean;
  };

  const productSeeds: ProductSeed[] = [
    // ── Dụng cụ nấu ăn ─────────────────────────────────────────────────
    {
      name: 'Bộ dao thớt gỗ tre 5 món',
      slug: 'bo-dao-thot-go-tre-5-mon',
      categorySlug: 'dung-cu-nau-an', price: 289_000, stock: 24,
      description: 'Set 4 dao đa năng + 1 thớt gỗ tre cao cấp. Lưỡi thép 3Cr14, cán inox chống trượt. Bảo hành 12 tháng.',
    },
    {
      name: 'Nồi gang tráng men 24cm xanh rêu',
      slug: 'noi-gang-trang-men-24cm',
      categorySlug: 'dung-cu-nau-an', price: 1_190_000, stock: 7,
      description: 'Nồi gang đúc nguyên khối, men ceramic 3 lớp không PFOA. Tương thích bếp từ. Nắp thủy tinh chịu nhiệt 230°C.',
    },
    {
      name: 'Máy xay cầm tay 3 tốc độ 500W',
      slug: 'may-xay-cam-tay-500w',
      categorySlug: 'thiet-bi-nha-bep', price: 459_000, stock: 0, // Hết hàng
      description: 'Công suất 500W, 3 tốc độ + turbo. Cốc đong 600ml, dao inox tháo rời. Bảo hành 18 tháng.',
    },
    {
      name: 'Bình giữ nhiệt 500ml cổ hẹp',
      slug: 'binh-giu-nhiet-500ml',
      categorySlug: 'do-dung-ban-an', price: 199_000, stock: 41,
      description: 'Inox 304 hai lớp chân không. Giữ nóng 12h, lạnh 24h. Không BPA.',
    },
    {
      name: 'Bộ 6 bát sứ Minh Long họa tiết tre',
      slug: 'bo-6-bat-su-minh-long',
      categorySlug: 'do-dung-ban-an', price: 349_000, stock: 15,
      description: 'Sứ Bone China, vẽ tay họa tiết tre. Dùng được lò vi sóng và máy rửa bát. Đường kính 14cm.',
    },
    {
      name: 'Bộ hộp đựng thực phẩm thủy tinh 5 món',
      slug: 'bo-hop-thuy-tinh-5-mon',
      categorySlug: 'do-dung-ban-an', price: 279_000, stock: 33,
      description: 'Thủy tinh borosilicate chịu nhiệt. Nắp PP khóa 4 chiều kín hơi. 5 kích thước: 300–1800ml.',
    },
    // ── Nội thất phòng khách ────────────────────────────────────────────
    {
      name: 'Sofa đơn vải linen khung gỗ sồi',
      slug: 'sofa-don-vai-linen-go-soi',
      categorySlug: 'noi-that-phong-khach', price: 2_890_000, stock: 3, // Sắp hết
      description: 'Khung gỗ sồi Nga nguyên khối. Đệm foam D30, vỏ linen Belgium. W80×D78×H85cm. Tải 150kg.',
    },
    {
      name: 'Kệ sách 5 tầng lắp ghép 160cm',
      slug: 'ke-sach-5-tang-160cm',
      categorySlug: 'noi-that-phong-khach', price: 749_000, stock: 15,
      description: 'Gỗ MDF phủ melamine vân óc chó. 5 tầng điều chỉnh độ cao. W60×D25×H160cm. Tải 20kg/tầng.',
    },
    {
      name: 'Thảm sợi tổng hợp 160×230cm',
      slug: 'tham-soi-tong-hop-160x230',
      categorySlug: 'tham-va-rem', price: 890_000, stock: 9,
      description: 'Polypropylene chống bám bụi, pile 8mm, đế cao su chống trượt. Giặt máy được.',
    },
    {
      name: 'Rèm vải dày cách nhiệt 2 tấm 140×260cm',
      slug: 'rem-vai-day-cach-nhiet',
      categorySlug: 'tham-va-rem', price: 680_000, stock: 12,
      description: 'Blackout 3 lớp, cản 99% ánh sáng. Kèm dây buộc và móc thép. W140×H260cm/tấm.',
    },
    // ── Đèn ────────────────────────────────────────────────────────────
    {
      name: 'Đèn cây góc phòng E27 ánh vàng',
      slug: 'den-cay-goc-phong-e27',
      categorySlug: 'den-trang-tri', price: 690_000, stock: 12,
      description: 'Chân sắt sơn đen, chao vải linen be. Cao 160cm, công tắc dây. Kèm bóng Edison 40W.',
    },
    {
      name: 'Đèn thả trần mây tre đan thủ công',
      slug: 'den-tha-tran-may-tre-dan',
      categorySlug: 'den-trang-tri', price: 420_000, stock: 18,
      description: 'Đan tay từ mây tre tự nhiên, mỗi chiếc một kiểu. Dây treo 1.5m. Ø35cm. Kèm bóng LED E27 9W.',
    },
    {
      name: 'Đèn bàn học chống cận 5 màu sáng',
      slug: 'den-ban-hoc-chong-can',
      categorySlug: 'den-chuc-nang', price: 259_000, stock: 33,
      description: 'LED 10W, 5 mức màu 2700–6500K, 5 mức sáng. USB-A bên hông. Cảm ứng chạm. Đạt chuẩn TUV.',
    },
    {
      name: 'Dây đèn LED trang trí 10m 100 bóng',
      slug: 'day-den-led-trang-tri-10m',
      categorySlug: 'den-trang-tri', price: 129_000, stock: 2, // Sắp hết
      description: 'Bóng không nóng, 5W/toàn dây. Dây đồng mảnh 0.3mm. Pin AA×3 hoặc USB. Chống nước IPX4.',
    },
    {
      name: 'Đèn ngủ cảm ứng chạm 3 mức sáng',
      slug: 'den-ngu-cam-ung-cham',
      categorySlug: 'den-chuc-nang', price: 149_000, stock: 47,
      description: 'Cảm ứng chạm thân, 3 mức sáng. Pin 1200mAh, sạc USB-C. Dùng 8h ở mức thấp nhất.',
    },
    // ── Trang trí & Cây cảnh ───────────────────────────────────────────
    {
      name: 'Chậu xi măng tối giản hình trụ Ø15cm',
      slug: 'chau-xi-mang-toi-gian-15cm',
      categorySlug: 'chau-cay-canh', price: 99_000, stock: 58,
      description: 'Đúc xi măng thủ công, mỗi chiếc một vân độc nhất. Lỗ thoát nước đáy. Ø15×H13cm.',
    },
    {
      name: 'Bộ 3 chậu sứ men trắng lệch kích thước',
      slug: 'bo-3-chau-su-men-trang',
      categorySlug: 'chau-cay-canh', price: 245_000, stock: 22,
      description: 'Sứ men trắng mờ. 3 kích thước: Ø10/13/16cm. Đĩa hứng nước kèm theo.',
    },
    {
      name: 'Tranh canvas phong cảnh núi bộ 3 tấm',
      slug: 'tranh-canvas-phong-canh-nui',
      categorySlug: 'tranh-dong-ho', price: 449_000, stock: 6,
      description: 'In UV trên canvas cotton 380gsm. Khung gỗ thông căng sẵn. 30×40cm/tấm. Kèm móc treo.',
    },
    {
      name: 'Đồng hồ treo tường gỗ óc chó Ø35cm',
      slug: 'dong-ho-treo-tuong-go-oc-cho',
      categorySlug: 'tranh-dong-ho', price: 559_000, stock: 11,
      description: 'Mặt gỗ óc chó CNC laser. Máy quartz Miyota (Nhật). Ø35cm, dày 4mm. Kim sơn vàng đồng.',
    },
    {
      name: 'Gương tròn viền kim loại sơn đen Ø60cm',
      slug: 'guong-tron-vien-den-60cm',
      categorySlug: 'tranh-dong-ho', price: 389_000, stock: 0, // Hết hàng
      description: 'Viền sắt sơn đen mờ dày 1.5cm. Kính không méo. Kèm móc dây thừng và móc thông thường.',
    },
    {
      name: 'Nến thơm sáp đậu nành quế & cam 200g',
      slug: 'nen-thom-sap-dau-nanh-que-cam',
      categorySlug: 'nen-huong-thom', price: 149_000, stock: 27,
      description: 'Sáp đậu nành 100% tự nhiên, không paraffin. Hương quế & cam, bền 30–35h. Lọ thủy tinh tái dùng.',
    },
    {
      name: 'Khuếch tán tinh dầu siêu âm 200ml',
      slug: 'khuech-tan-tinh-dau-sieu-am',
      categorySlug: 'nen-huong-thom', price: 320_000, stock: 14,
      description: 'Siêu âm 2.4MHz, không nhiệt. 200ml, phủ ~30m². Đèn LED 7 màu. Tự tắt khi cạn nước.',
    },
    {
      name: 'Bộ 6 thỏi nhang Nhật trầm hương',
      slug: 'bo-6-thoi-nhang-nhat-tram-huong',
      categorySlug: 'nen-huong-thom', price: 185_000, stock: 35,
      description: 'Bột gỗ tự nhiên, không than đen. 6 mùi: trầm, bạch đàn, tuyết tùng, đàn hương, nhài, anh đào. ~45ph/thỏi.',
    },
    // ── Soft delete — test FR-C3 + BR5 ────────────────────────────────
    {
      name: 'Máy pha cà phê espresso ngừng bán',
      slug: 'may-pha-ca-phe-espresso-cu',
      categorySlug: 'thiet-bi-nha-bep', price: 3_900_000, stock: 0,
      description: 'Sản phẩm ngừng kinh doanh. Chỉ dùng để test soft delete.',
      deleted: true,
    },
  ];

  const productMap: Record<string, string> = {};

  for (const p of productSeeds) {
    const catId = categoryMap[p.categorySlug];
    if (!catId) throw new Error(`Category slug không tìm thấy: ${p.categorySlug}`);

    const product = await prisma.product.upsert({
      where:  { slug: p.slug },
      update: {
        price:     new Decimal(p.price),
        stock:     p.stock,
        deletedAt: p.deleted ? new Date('2024-01-01') : null,
      },
      create: {
        categoryId:  catId,
        name:        p.name,
        slug:        p.slug,
        description: p.description,
        price:       new Decimal(p.price),
        stock:       p.stock,
        deletedAt:   p.deleted ? new Date('2024-01-01') : null,
      },
    });
    productMap[p.slug] = product.id;

    // Ảnh placeholder — xóa cũ rồi tạo lại để idempotent
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    const imgCount = p.deleted ? 1 : 2;
    for (let i = 0; i < imgCount; i++) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url:       `${PLACEHOLDER_BASE}/${p.slug}-${i}/600/400`,
          publicId:  `shoplite/seed/${p.slug}-${i}`,  // placeholder, không có trên Cloudinary thật
          sortOrder: i,
        },
      });
    }
  }

  const deletedCount = productSeeds.filter((p) => p.deleted).length;
  console.log(`   ✓ ${productSeeds.length} sản phẩm (${deletedCount} đã soft delete)\n`);

  // ═══════════════════════════════════════════
  // 5. ORDERS — 14 đơn rải 30 ngày để dashboard có dữ liệu
  // ═══════════════════════════════════════════

  console.log('🛒 Tạo orders...');

  type OrderItemSeed = {
    productSlug: string;
    productName: string;
    unitPrice:   number;
    quantity:    number;
  };

  type OrderSeed = {
    userEmail:      string;
    status:         OrderStatus;
    items:          OrderItemSeed[];
    createdAt:      Date;
    shippingAddress:string;
    paymentStatus?: PaymentStatus;
    providerTxnId?: string | null;  // null với đơn FAILED/PENDING
  };

  const orderSeeds: OrderSeed[] = [
    // ── Tuần này ─────────────────────────────────────────────────────
    {
      userEmail: 'cong@webpx.vn', status: 'PAID', createdAt: daysAgo(1, 3),
      shippingAddress: 'Số 5 ngõ 12 Thái Hà, Đống Đa, Hà Nội',
      items: [
        { productSlug: 'den-cay-goc-phong-e27',       productName: 'Đèn cây góc phòng E27 ánh vàng',       unitPrice: 690_000, quantity: 1 },
        { productSlug: 'nen-thom-sap-dau-nanh-que-cam', productName: 'Nến thơm sáp đậu nành quế & cam 200g', unitPrice: 149_000, quantity: 2 },
      ],
      paymentStatus: 'COMPLETED', providerTxnId: fakeTxnId(),
    },
    {
      userEmail: 'lan.nguyen@gmail.com', status: 'PENDING', createdAt: daysAgo(0, 2),
      shippingAddress: '12 Lê Lợi, Quận 1, TP.HCM',
      items: [
        { productSlug: 'binh-giu-nhiet-500ml', productName: 'Bình giữ nhiệt 500ml cổ hẹp', unitPrice: 199_000, quantity: 2 },
      ],
      // PENDING: không có payment
    },
    {
      userEmail: 'duc.tran@gmail.com', status: 'CANCELLED', createdAt: daysAgo(2, 5),
      shippingAddress: '89 Nguyễn Huệ, Hải Châu, Đà Nẵng',
      items: [
        { productSlug: 'den-ban-hoc-chong-can', productName: 'Đèn bàn học chống cận 5 màu sáng', unitPrice: 259_000, quantity: 1 },
      ],
      paymentStatus: 'FAILED',
      // providerTxnId: undefined — payment thất bại, không có txn id
    },
    // ── Tuần trước ──────────────────────────────────────────────────
    {
      userEmail: 'cong@webpx.vn', status: 'SHIPPED', createdAt: daysAgo(5),
      shippingAddress: 'Số 5 ngõ 12 Thái Hà, Đống Đa, Hà Nội',
      items: [
        { productSlug: 'ke-sach-5-tang-160cm',     productName: 'Kệ sách 5 tầng lắp ghép 160cm',   unitPrice: 749_000, quantity: 1 },
        { productSlug: 'tham-soi-tong-hop-160x230', productName: 'Thảm sợi tổng hợp 160×230cm',     unitPrice: 890_000, quantity: 1 },
      ],
      paymentStatus: 'COMPLETED', providerTxnId: fakeTxnId(),
    },
    {
      userEmail: 'lan.nguyen@gmail.com', status: 'COMPLETED', createdAt: daysAgo(7),
      shippingAddress: '12 Lê Lợi, Quận 1, TP.HCM',
      items: [
        { productSlug: 'chau-xi-mang-toi-gian-15cm',   productName: 'Chậu xi măng tối giản Ø15cm',        unitPrice: 99_000,  quantity: 3 },
        { productSlug: 'nen-thom-sap-dau-nanh-que-cam', productName: 'Nến thơm sáp đậu nành quế & cam 200g', unitPrice: 149_000, quantity: 1 },
      ],
      paymentStatus: 'COMPLETED', providerTxnId: fakeTxnId(),
    },
    {
      userEmail: 'duc.tran@gmail.com', status: 'COMPLETED', createdAt: daysAgo(9),
      shippingAddress: '89 Nguyễn Huệ, Hải Châu, Đà Nẵng',
      items: [
        { productSlug: 'den-ngu-cam-ung-cham', productName: 'Đèn ngủ cảm ứng chạm 3 mức sáng', unitPrice: 149_000, quantity: 2 },
        { productSlug: 'day-den-led-trang-tri-10m', productName: 'Dây đèn LED trang trí 10m',   unitPrice: 129_000, quantity: 1 },
      ],
      paymentStatus: 'COMPLETED', providerTxnId: fakeTxnId(),
    },
    // ── 2 tuần trước ────────────────────────────────────────────────
    {
      userEmail: 'cong@webpx.vn', status: 'COMPLETED', createdAt: daysAgo(12),
      shippingAddress: 'Số 5 ngõ 12 Thái Hà, Đống Đa, Hà Nội',
      items: [
        { productSlug: 'bo-dao-thot-go-tre-5-mon', productName: 'Bộ dao thớt gỗ tre 5 món',              unitPrice: 289_000, quantity: 1 },
        { productSlug: 'bo-hop-thuy-tinh-5-mon',   productName: 'Bộ hộp đựng thực phẩm thủy tinh 5 món', unitPrice: 279_000, quantity: 1 },
      ],
      paymentStatus: 'COMPLETED', providerTxnId: fakeTxnId(),
    },
    {
      userEmail: 'lan.nguyen@gmail.com', status: 'COMPLETED', createdAt: daysAgo(14),
      shippingAddress: '12 Lê Lợi, Quận 1, TP.HCM',
      items: [
        { productSlug: 'tranh-canvas-phong-canh-nui', productName: 'Tranh canvas phong cảnh núi bộ 3 tấm', unitPrice: 449_000, quantity: 1 },
        { productSlug: 'dong-ho-treo-tuong-go-oc-cho', productName: 'Đồng hồ treo tường gỗ óc chó Ø35cm', unitPrice: 559_000, quantity: 1 },
      ],
      paymentStatus: 'COMPLETED', providerTxnId: fakeTxnId(),
    },
    {
      userEmail: 'duc.tran@gmail.com', status: 'CANCELLED', createdAt: daysAgo(15),
      shippingAddress: '89 Nguyễn Huệ, Hải Châu, Đà Nẵng',
      items: [
        { productSlug: 'sofa-don-vai-linen-go-soi', productName: 'Sofa đơn vải linen khung gỗ sồi', unitPrice: 2_890_000, quantity: 1 },
      ],
      paymentStatus: 'FAILED',
    },
    // ── 3–4 tuần trước (line chart doanh thu rải đều) ───────────────
    {
      userEmail: 'cong@webpx.vn', status: 'COMPLETED', createdAt: daysAgo(18),
      shippingAddress: 'Số 5 ngõ 12 Thái Hà, Đống Đa, Hà Nội',
      items: [
        { productSlug: 'khuech-tan-tinh-dau-sieu-am',    productName: 'Khuếch tán tinh dầu siêu âm 200ml',    unitPrice: 320_000, quantity: 1 },
        { productSlug: 'bo-6-thoi-nhang-nhat-tram-huong', productName: 'Bộ 6 thỏi nhang Nhật trầm hương',       unitPrice: 185_000, quantity: 2 },
      ],
      paymentStatus: 'COMPLETED', providerTxnId: fakeTxnId(),
    },
    {
      userEmail: 'lan.nguyen@gmail.com', status: 'COMPLETED', createdAt: daysAgo(21),
      shippingAddress: '12 Lê Lợi, Quận 1, TP.HCM',
      items: [
        { productSlug: 'bo-6-bat-su-minh-long', productName: 'Bộ 6 bát sứ Minh Long họa tiết tre', unitPrice: 349_000, quantity: 1 },
        { productSlug: 'binh-giu-nhiet-500ml',  productName: 'Bình giữ nhiệt 500ml cổ hẹp',        unitPrice: 199_000, quantity: 3 },
      ],
      paymentStatus: 'COMPLETED', providerTxnId: fakeTxnId(),
    },
    {
      userEmail: 'duc.tran@gmail.com', status: 'COMPLETED', createdAt: daysAgo(24),
      shippingAddress: '89 Nguyễn Huệ, Hải Châu, Đà Nẵng',
      items: [
        { productSlug: 'den-tha-tran-may-tre-dan', productName: 'Đèn thả trần mây tre đan thủ công', unitPrice: 420_000, quantity: 2 },
      ],
      paymentStatus: 'COMPLETED', providerTxnId: fakeTxnId(),
    },
    {
      userEmail: 'cong@webpx.vn', status: 'COMPLETED', createdAt: daysAgo(27),
      shippingAddress: 'Số 5 ngõ 12 Thái Hà, Đống Đa, Hà Nội',
      items: [
        { productSlug: 'bo-3-chau-su-men-trang',          productName: 'Bộ 3 chậu sứ men trắng lệch kích thước', unitPrice: 245_000, quantity: 2 },
        { productSlug: 'nen-thom-sap-dau-nanh-que-cam',   productName: 'Nến thơm sáp đậu nành quế & cam 200g',   unitPrice: 149_000, quantity: 3 },
      ],
      paymentStatus: 'COMPLETED', providerTxnId: fakeTxnId(),
    },
    {
      userEmail: 'lan.nguyen@gmail.com', status: 'COMPLETED', createdAt: daysAgo(29),
      shippingAddress: '12 Lê Lợi, Quận 1, TP.HCM',
      items: [
        { productSlug: 'rem-vai-day-cach-nhiet',   productName: 'Rèm vải dày cách nhiệt 2 tấm 140×260cm', unitPrice: 680_000, quantity: 1 },
        { productSlug: 'tham-soi-tong-hop-160x230', productName: 'Thảm sợi tổng hợp 160×230cm',           unitPrice: 890_000, quantity: 1 },
      ],
      paymentStatus: 'COMPLETED', providerTxnId: fakeTxnId(),
    },
  ];

  const userMap: Record<string, string> = {
    'admin@shoplite.dev':     admin.id,
    'cong@webpx.vn':          customerCong.id,
    'lan.nguyen@gmail.com':   customerLan.id,
    'duc.tran@gmail.com':     customerDuc.id,
  };

  let orderCount = 0;
  for (const o of orderSeeds) {
    const userId = userMap[o.userEmail];
    if (!userId) throw new Error(`User không tìm thấy: ${o.userEmail}`);

    // Idempotency key cố định → chạy lại seed không tạo trùng đơn
    const idempotencyKey = deterministicHash(`seed-order-${o.userEmail}-${o.createdAt.getTime()}`);

    const exists = await prisma.order.findFirst({ where: { idempotencyKey } });
    if (exists) continue;

    const items = o.items.map((item) => {
      const productId = productMap[item.productSlug];
      if (!productId) throw new Error(`Product slug không tìm thấy: ${item.productSlug}`);
      return {
        productId,
        productName: item.productName,
        unitPrice:   new Decimal(item.unitPrice),
        quantity:    item.quantity,
      };
    });

    const totalAmount = calcTotal(items);

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          status:          o.status,
          totalAmount,
          idempotencyKey,
          shippingAddress: o.shippingAddress,
          createdAt:       o.createdAt,
          updatedAt:       o.createdAt,
          items: {
            create: items.map((item) => ({
              productId:   item.productId,
              productName: item.productName,
              unitPrice:   item.unitPrice,
              quantity:    item.quantity,
            })),
          },
        },
      });

      // History đúng state machine — không nhảy cóc
      for (const entry of buildHistoryEntries(o.status, o.createdAt)) {
        await tx.orderStatusHistory.create({
          data: {
            orderId:    order.id,
            fromStatus: entry.from ?? undefined,  // null → undefined cho Prisma optional field
            toStatus:   entry.to,
            reason:     entry.reason,
            createdAt:  entry.at,
          },
        });
      }

      // Payment — chỉ khi có paymentStatus
      if (o.paymentStatus) {
        await tx.payment.create({
          data: {
            orderId:       order.id,
            amount:        totalAmount,
            status:        o.paymentStatus,
            providerTxnId: o.providerTxnId ?? null,
            createdAt:     new Date(o.createdAt.getTime() + 1_000),
          },
        });
      }
    });

    orderCount++;
  }

  console.log(`   ✓ ${orderCount} đơn hàng tạo mới (${orderSeeds.length - orderCount} đã tồn tại, bỏ qua)\n`);

  // ═══════════════════════════════════════════
  // 6. CART — giỏ hàng mẫu cho cong@webpx.vn
  // ═══════════════════════════════════════════

  console.log('🛍️  Tạo cart mẫu...');

  const cartCong = await prisma.cart.upsert({
    where:  { userId: customerCong.id },
    update: { updatedAt: new Date() },
    create: { userId: customerCong.id },
  });

  await prisma.cartItem.deleteMany({ where: { cartId: cartCong.id } });

  const cartItems = [
    { productSlug: 'chau-xi-mang-toi-gian-15cm', quantity: 2 },
    { productSlug: 'den-ban-hoc-chong-can',       quantity: 1 },
    { productSlug: 'bo-6-thoi-nhang-nhat-tram-huong', quantity: 1 },
  ];

  for (const item of cartItems) {
    const productId = productMap[item.productSlug];
    if (!productId) continue;
    await prisma.cartItem.create({
      data: { cartId: cartCong.id, productId, quantity: item.quantity },
    });
  }

  console.log(`   ✓ Cart của cong@webpx.vn: ${cartItems.length} sản phẩm\n`);

  // ═══════════════════════════════════════════
  // 7. SUMMARY
  // ═══════════════════════════════════════════

  const [uCount, catCount, pCount, oCount, payCount] = await prisma.$transaction([
    prisma.user.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.payment.count(),
  ]);

  console.log('✅ Seed hoàn thành!\n');
  console.log('📊 Tổng kết:');
  console.log(`   Users:      ${uCount}`);
  console.log(`   Categories: ${catCount}`);
  console.log(`   Products:   ${pCount} (${deletedCount} đã xóa mềm)`);
  console.log(`   Orders:     ${oCount}`);
  console.log(`   Payments:   ${payCount}\n`);

  console.log('🔑 Tài khoản demo (password: Webpx@2024):');
  console.log('   admin@shoplite.dev           → ADMIN');
  console.log('   cong@webpx.vn                → CUSTOMER (verified, có cart + lịch sử đơn)');
  console.log('   lan.nguyen@gmail.com          → CUSTOMER (verified)');
  console.log('   duc.tran@gmail.com            → CUSTOMER (verified)');
  console.log('   hanh.unverified@gmail.com     → CUSTOMER (chưa verify — test FR-A2)');
  console.log('   locked.user@gmail.com         → CUSTOMER (bị khóa — test admin lock)\n');
}

// ─────────────────────────────────────────────
// STATE MACHINE HELPER
// ─────────────────────────────────────────────

type HistoryEntry = {
  from:   OrderStatus | null;
  to:     OrderStatus;
  reason: string;
  at:     Date;
};

function buildHistoryEntries(finalStatus: OrderStatus, createdAt: Date): HistoryEntry[] {
  const t   = createdAt.getTime();
  const hr  = 60 * 60 * 1_000;
  const day = 24 * hr;

  // Bản ghi đầu tiên luôn là tạo đơn (from = null)
  const entries: HistoryEntry[] = [
    { from: null, to: 'PENDING', reason: 'Đơn hàng được tạo', at: new Date(t) },
  ];

  if (finalStatus === 'PENDING') return entries;

  if (finalStatus === 'CANCELLED') {
    entries.push({ from: 'PENDING', to: 'CANCELLED', reason: 'Thanh toán thất bại — hoàn kho tự động', at: new Date(t + hr) });
    return entries;
  }

  entries.push({ from: 'PENDING', to: 'PAID', reason: 'Thanh toán thành công', at: new Date(t + 0.5 * hr) });
  if (finalStatus === 'PAID') return entries;

  entries.push({ from: 'PAID', to: 'SHIPPED', reason: 'Bàn giao đơn vị vận chuyển', at: new Date(t + day) });
  if (finalStatus === 'SHIPPED') return entries;

  entries.push({ from: 'SHIPPED', to: 'COMPLETED', reason: 'Giao hàng thành công', at: new Date(t + 4 * day) });
  return entries;
}

// ─────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error('❌ Seed thất bại:', e);
    await prisma.$disconnect();
    // Dùng throw thay vì process.exit để tránh cần @types/node cho global process
    throw e;
  });