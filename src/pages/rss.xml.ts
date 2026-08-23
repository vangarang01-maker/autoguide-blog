import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE, SITE_TITLE_KO, categoryOf } from '../consts';

export async function GET(context: APIContext) {
  const posts = (await getCollection('blog')).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );

  return rss({
    title: `${SITE_TITLE} — ${SITE_TITLE_KO}`,
    description: SITE_DESCRIPTION,
    site: context.site ?? 'https://autoguide-blog.vercel.app',
    trailingSlash: true,
    xmlns: { dc: 'http://purl.org/dc/elements/1.1/' },
    customData: [
      '<language>ko-kr</language>',
      '<copyright>© AutoGuide. All rights reserved.</copyright>',
      '<ttl>60</ttl>',
    ].join(''),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
      categories: [categoryOf(post.data.category).name, ...post.data.tags],
      author: post.data.author,
      customData: `<dc:creator><![CDATA[${post.data.author}]]></dc:creator>`,
    })),
  });
}
