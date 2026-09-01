import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum(['maintenance', 'buying', 'eco', 'driving']),
    tags: z.array(z.string()).default([]),
    heroEmoji: z.string().default('🚗'),
    /** og:image 및 목록 썸네일. 스톡 사진 또는 자동 생성한 SVG 카드 */
    heroImage: z.string().optional(),
    heroImageCredit: z.string().optional(),
    featured: z.boolean().default(false),
    author: z.string().default('김도현'),
  }),
});

export const collections = { blog };
