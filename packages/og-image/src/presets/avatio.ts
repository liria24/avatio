import { definePreset } from '../definePreset'
import { avatioImagePropsSchema, type AvatioImageProps } from '../schema'

const texts = {
    footerTitle: 'Avatio',
    footerSubtitle: 'avatio.liria.me',
}

const avatioPreset = definePreset<AvatioImageProps>({
    id: 'avatio',
    version: 'v1',
    cacheKey: 'avatio:v1:noto-sans-jp-google-fonts-variable',
    schema: avatioImagePropsSchema,
    width: 1200,
    height: 630,
    fonts: [{ family: 'Noto Sans JP', options: { weight: '100..900' } }],
    fontText: ({ title, description }) =>
        [title, description, ...Object.values(texts)].filter((text) => Boolean(text)).join('\n'),
    render: ({ title, description }) => ({
        type: 'container',
        style: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '72px',
            backgroundColor: '#111113',
            color: '#f4f4f5',
            fontFamily: 'Noto Sans JP',
        },
        children: [
            {
                type: 'container',
                style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                },
                children: [
                    {
                        type: 'text',
                        text: title,
                        style: {
                            fontSize: '68px',
                            fontWeight: 800,
                            lineHeight: 1.12,
                            letterSpacing: '0px',
                            maxWidth: '960px',
                        },
                    },
                    ...(description
                        ? [
                              {
                                  type: 'text' as const,
                                  text: description,
                                  style: {
                                      fontSize: '34px',
                                      fontWeight: 500,
                                      lineHeight: 1.45,
                                      color: '#d4d4d8',
                                      maxWidth: '900px',
                                  },
                              },
                          ]
                        : []),
                ],
            },
            {
                type: 'container',
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                },
                children: [
                    {
                        type: 'text',
                        text: texts.footerTitle,
                        style: {
                            fontSize: '34px',
                            fontWeight: 800,
                            color: '#ffffff',
                        },
                    },
                    {
                        type: 'text',
                        text: texts.footerSubtitle,
                        style: {
                            fontSize: '24px',
                            fontWeight: 500,
                            color: '#a1a1aa',
                        },
                    },
                ],
            },
        ],
    }),
})

export default avatioPreset
