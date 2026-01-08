import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const coupons = [
  "OBLIVION",
  "TARGETWISH",
  "DELLONSVSKRIS",
  "HALFGOODHALFEVIL",
  "GOLDENKINGPEPE",
  "LETSGO7K",
  "POOKIFIVEKINDS",
  "KEYKEYKEY",
  "100MILLIONHEARTS",
  "77EVENT77",
  "CHAOSESSENCE",
  "SENAHAJASENA",
  "GRACEOFCHAOS",
  "BRANZEBRANSEL",
  "DANCINGPOOKI",
  "7S7E7V7E7N7",
  "HAPPYNEWYEAR2026",
  "SENASTARCRYSTAL",
  "SENA77MEMORY",
];

async function main() {
  console.log("Seeding database...");

  for (const code of coupons) {
    await prisma.coupon.upsert({
      where: { code },
      update: {},
      create: { code },
    });
    console.log(`Upserted coupon: ${code}`);
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
