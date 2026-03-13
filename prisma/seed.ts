// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Minimal starter set (~10) so the system has targets
  const labs = [
    {
      slug: "mbari",
      name: "Monterey Bay Aquarium Research Institute (MBARI)",
      org: "MBARI",
      country: "USA",
      domain: "MARINE" as const,
      homepageUrl: "https://www.mbari.org/",
      sources: [
        { type: "WEBSITE" as const, name: "News", url: "https://www.mbari.org/news/" },
        { type: "YOUTUBE" as const, name: "YouTube", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCFXww6CrLAHhyZQCDnJ2g2A" },
        { type: "GITHUB" as const, name: "GitHub", url: "https://github.com/mbari-org/MB-System" },
      ],
    },
    {
      slug: "whoi-dsl",
      name: "Woods Hole Oceanographic Institution — Deep Submergence Laboratory",
      org: "WHOI",
      country: "USA",
      domain: "MARINE" as const,
      homepageUrl: "https://www.whoi.edu/",
      sources: [{ type: "WEBSITE" as const, name: "News", url: "https://www.whoi.edu/news/" }],
    },
    {
      slug: "uw-apl-ocean",
      name: "University of Washington — Applied Physics Laboratory (Ocean Engineering)",
      org: "University of Washington APL",
      country: "USA",
      domain: "MARINE" as const,
      homepageUrl: "https://www.apl.washington.edu/",
      sources: [{ type: "WEBSITE" as const, name: "News", url: "https://www.apl.washington.edu/news" }],
    },
    {
      slug: "ntnu-amos",
      name: "NTNU — Centre for Autonomous Marine Operations and Systems (AMOS)",
      org: "NTNU AMOS",
      country: "Norway",
      domain: "MARINE" as const,
      homepageUrl: "https://www.ntnu.edu/amos",
      sources: [{ type: "WEBSITE" as const, name: "News", url: "https://www.ntnu.edu/amos/news" }],
    },
    {
      slug: "eth-asl",
      name: "ETH Zürich — Autonomous Systems Lab (ASL)",
      org: "ETH Zürich",
      country: "Switzerland",
      domain: "MARINE" as const,
      homepageUrl: "https://asl.ethz.ch/",
      sources: [{ type: "WEBSITE" as const, name: "News", url: "https://asl.ethz.ch/news.html" }],
    },
    {
      slug: "stanford-oceanic-robotics",
      name: "Stanford — Oceanic Robotics Group",
      org: "Stanford University",
      country: "USA",
      domain: "MARINE" as const,
      homepageUrl: "https://stanford.edu/",
      sources: [{ type: "WEBSITE" as const, name: "Homepage", url: "https://oceanic.stanford.edu/" }],
    },
    {
      slug: "uw-reality-lab",
      name: "University of Washington — Reality Lab",
      org: "University of Washington",
      country: "USA",
      domain: "XR" as const,
      homepageUrl: "https://realitylab.uw.edu/",
      sources: [{ type: "WEBSITE" as const, name: "News", url: "https://realitylab.uw.edu/news/" }],
    },
    {
      slug: "mit-media-lab",
      name: "MIT Media Lab",
      org: "MIT",
      country: "USA",
      domain: "XR" as const,
      homepageUrl: "https://www.media.mit.edu/",
      sources: [{ type: "WEBSITE" as const, name: "News", url: "https://www.media.mit.edu/posts/" }],
    },
    {
      slug: "tum-visual-computing",
      name: "TUM — Visual Computing Group",
      org: "Technical University of Munich",
      country: "Germany",
      domain: "XR" as const,
      homepageUrl: "https://www.cs.cit.tum.de/vc/home/",
      sources: [{ type: "WEBSITE" as const, name: "News", url: "https://www.cs.cit.tum.de/vc/news/" }],
    },
    {
      slug: "max-planck-perceiving-systems",
      name: "Max Planck Institute — Perceiving Systems",
      org: "Max Planck Society",
      country: "Germany",
      domain: "XR" as const,
      homepageUrl: "https://ps.is.mpg.de/",
      sources: [{ type: "WEBSITE" as const, name: "News", url: "https://ps.is.mpg.de/news" }],
    },
  ];

  for (const lab of labs) {
    await prisma.lab.upsert({
      where: { slug: lab.slug },
      update: {
        name: lab.name,
        org: lab.org,
        country: lab.country,
        domain: lab.domain,
        homepageUrl: lab.homepageUrl,
        isActive: true,
      },
      create: {
        slug: lab.slug,
        name: lab.name,
        org: lab.org,
        country: lab.country,
        domain: lab.domain,
        homepageUrl: lab.homepageUrl,
        isActive: true,
        sources: {
          create: lab.sources.map((s) => ({
            type: s.type,
            name: s.name,
            url: s.url,
            isActive: true,
          })),
        },
      },
    });
  }

  console.log(`Seeded ${labs.length} labs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });