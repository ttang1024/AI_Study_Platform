export const siteUrl =
	process.env.NEXT_PUBLIC_SITE_URL ??
	process.env.NEXT_PUBLIC_SHARE_BASE_URL ??
	process.env.VITE_SHARE_BASE_URL ??
	'https://d2c6dqq9zfj5j0.cloudfront.net'

export const defaultShareTitle = 'toto.ai - AI Study Platform'
export const defaultShareDescription =
	'Turn documents, YouTube videos, podcasts, audio lectures, and web articles into AI summaries, mind maps, flashcards, and quizzes.'
export const defaultShareImage = '/share.png'
export const defaultShareImageWidth = 1200
export const defaultShareImageHeight = 630

export const absoluteUrl = (path: string) => new URL(path, siteUrl).toString()

export const getWechatShareMetadata = (title: string, description: string, imagePath: string) => ({
	'wechat:title': title,
	'wechat:description': description,
	'wechat:image': absoluteUrl(imagePath),
	image_src: absoluteUrl(imagePath),
})
