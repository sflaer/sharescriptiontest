import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SYSTEM = [
  { slug: "entertainment", name: "Развлечения" },
  { slug: "work", name: "Рабочие сервисы" },
  { slug: "health", name: "Здоровье" },
  { slug: "finance", name: "Финансы" },
];

async function main() {
  for (const c of SYSTEM) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, userId: null },
      update: { name: c.name },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
