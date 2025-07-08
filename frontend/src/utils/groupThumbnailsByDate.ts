interface ThumbnailItem {
  id: string;
  date: string;
  thumbnail: string;
  isVideo: boolean;
}

interface ThumbnailGroup {
  date: string;
  thumbnails: { id: string; thumbnail: string; isVideo: boolean }[];
}

type Thumbnails = ThumbnailGroup[];

export function groupThumbnailsByDate(thumbs: ThumbnailItem[]): Thumbnails {
  return thumbs.reduce<Thumbnails>((acc, current) => {
    const date = current.date;
    let group = acc.find((g) => g.date === date);

    if (!group) {
      group = { date, thumbnails: [] };
      acc.push(group);
    }

    group.thumbnails.push({
      id: current.id,
      thumbnail: current.thumbnail,
      isVideo: current.isVideo,
    });

    return acc;
  }, []);
}
