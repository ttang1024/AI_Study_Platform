export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SHARE_BASE_URL ?? 'https://toto-ai.com';

export const absoluteUrl = (path: string) => new URL(path, siteUrl).toString();

export const getWechatShareMetadata = (title: string, description: string, imagePath: string) => ({
  'wechat:title': title,
  'wechat:description': description,
  'wechat:image': absoluteUrl(imagePath),
  'image_src': absoluteUrl(imagePath),
});
