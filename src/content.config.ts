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
    /** 글 상단·목록 썸네일용. 스톡 사진이 있으면 사진, 없으면 SVG 카드 */
    heroImage: z.string().optional(),
    heroImageCredit: z.string().optional(),
    /** Pexels 사진 ID. 실행을 나눠 돌려도 사진이 겹치지 않게 하는 배정 키 */
    heroImageId: z.string().optional(),
    /** 공유용 1200x630 카드. 제목이 박혀 있어 사진보다 전달력이 좋다 */
    ogImage: z.string().optional(),
    featured: z.boolean().default(false),
    author: z.string().default('김도현'),
  }),
});

export const collections = { blog };
