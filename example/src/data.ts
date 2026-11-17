import type { StoryItem, StoryUser } from 'rn-story-kit';

// Thumbhashes come from `node scripts/thumbhash.mjs`.
const HASH: Record<number, string> = {
  10: 'W8cVHAqI+HiHd4Znd3h3gHcGiA==',
  15: '2NcJBAJaCmdKd2pYl4jK/8oIaQ==',
  20: '8SgGDAKsQ6wLiWqXV2iXDFzH8A==',
  28: '29gJNAR452j4h4hYiFeZZIA3+g==',
  29: 'n+cJHAZ6iXaXdaAod3d5cIQHNw==',
  37: 'LQgWDAB5+IdXh4h3d5iWgB2viQ==',
  42: '5DgSFARm+Id3eHiHd4h8kMcHiA==',
  48: 'IDkKFAKF+HmXdpV4iJeAtwtJvA==',
  57: 'mdcRFAYn9miniHd5h3jmf2H7Rw==',
  64: 'KxgKFALlybb5aJ6UaJjyeA5JeA==',
  65: 'JVoKJAZB94XIep13eXpCcHUHVg==',
  76: 'mhgKFASciHYHh5OXlqdQUwvjMQ==',
  82: '5vcNDARKdHYIeYxGp1ZUiSD6Wg==',
  91: 'CggGBAA4qGk5yYv3eFgniHCCCA==',
  96: 'oPcNJAZoCIjXiHlXp4h3gGcGaA==',
  100: '8ggGDABuyIYXd5CHl1eEgGkIWA==',
};

const VIDEO_BASE =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/';
const MIN = 60 * 1000;

const image = (
  userId: string,
  n: number,
  pic: number,
  minutesAgo: number,
  seen = false
): StoryItem => ({
  id: `${userId}-${n}`,
  type: 'image',
  uri: `https://picsum.photos/id/${pic}/1080/1920`,
  thumbhash: HASH[pic],
  alt: `Photo ${pic}`,
  createdAt: Date.now() - minutesAgo * MIN,
  seen,
});

const video = (
  userId: string,
  n: number,
  file: string,
  minutesAgo: number
): StoryItem => ({
  id: `${userId}-${n}`,
  type: 'video',
  uri: `${VIDEO_BASE}${file}`,
  createdAt: Date.now() - minutesAgo * MIN,
});

const avatar = (pic: number) => `https://picsum.photos/id/${pic}/200/200`;

export function makeUsers(): StoryUser[] {
  return [
    {
      id: 'ada',
      name: 'ada',
      avatar: avatar(64),
      stories: [
        image('ada', 1, 10, 5),
        video('ada', 2, 'ForBiggerBlazes.mp4', 4),
        image('ada', 3, 15, 3),
      ],
    },
    {
      id: 'bruno',
      name: 'bruno',
      avatar: avatar(65),
      ringVariant: 'ocean',
      stories: [image('bruno', 1, 20, 40), image('bruno', 2, 28, 30)],
    },
    {
      id: 'chen',
      name: 'chen',
      avatar: avatar(91),
      stories: [video('chen', 1, 'ForBiggerEscapes.mp4', 90)],
    },
    {
      id: 'dara',
      name: 'close friends',
      avatar: avatar(96),
      ringVariant: 'closeFriends',
      stories: [image('dara', 1, 29, 120), image('dara', 2, 37, 100)],
    },
    {
      id: 'eli',
      name: 'eli',
      avatar: avatar(100),
      ringVariant: 'sunset',
      stories: [
        image('eli', 1, 42, 200),
        image('eli', 2, 48, 190),
        video('eli', 3, 'ForBiggerFun.mp4', 180),
      ],
    },
    {
      id: 'fatima',
      name: 'fatima',
      avatar: avatar(76),
      stories: [image('fatima', 1, 57, 300)],
    },
    {
      id: 'gus',
      name: 'gus',
      avatar: avatar(82),
      ringVariant: 'mono',
      stories: [
        video('gus', 1, 'ForBiggerJoyrides.mp4', 400),
        image('gus', 2, 64, 390),
      ],
    },
    {
      id: 'hana',
      name: 'hana (seen)',
      avatar: avatar(10),
      stories: [
        image('hana', 1, 65, 600, true),
        image('hana', 2, 76, 590, true),
      ],
    },
    {
      id: 'ivan',
      name: 'ivan',
      avatar: avatar(15),
      stories: [image('ivan', 1, 82, 700), image('ivan', 2, 91, 690)],
    },
    {
      id: 'jun',
      name: 'jun',
      avatar: avatar(20),
      ringVariant: 'ocean',
      stories: [video('jun', 1, 'ForBiggerMeltdowns.mp4', 800)],
    },
    {
      id: 'kai',
      name: 'kai',
      avatar: avatar(28),
      stories: [image('kai', 1, 96, 900), image('kai', 2, 100, 880)],
    },
    {
      id: 'lena',
      name: 'lena',
      avatar: avatar(29),
      ringVariant: 'sunset',
      stories: [image('lena', 1, 10, 1000), image('lena', 2, 37, 990)],
    },
  ];
}

/** Many users, for the performance screen. */
export function makeManyUsers(count: number): StoryUser[] {
  const base = makeUsers();
  return Array.from({ length: count }, (_, i) => {
    const src = base[i % base.length]!;
    return {
      ...src,
      id: `u${i}`,
      name: `user ${i + 1}`,
      stories: src.stories.map((s, j) => ({
        ...s,
        id: `u${i}-${j}`,
        seen: false,
      })),
    };
  });
}
