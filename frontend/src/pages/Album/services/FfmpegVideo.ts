import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";
let fileCounter = 0;
export class FfmpegVideo {
  private constructor(
    private ffmpeg: FFmpeg,
    private videoFileName: string,
  ) {}

  static async open(ffmpeg: FFmpeg, file: File) {
    const fileName = `input${++fileCounter}`;
    await ffmpeg.load({ coreURL, wasmURL });
    await ffmpeg.writeFile(fileName, await fetchFile(file));
    return new FfmpegVideo(ffmpeg, fileName);
  }

  async *getSlices(segmentSeconds = 20) {
    console.log("slices");
    await this.ffmpeg.exec([
      "-i",
      this.videoFileName,
      "-c",
      "copy",
      "-f",
      "segment",
      "-segment_time",
      segmentSeconds.toString(),
      "-reset_timestamps",
      "1",
      "-map",
      "0",
      `output_%03d.mp4`,
    ]);
    let index = 0;
    while (true) {
      let data;
      try {
        data = await this.ffmpeg.readFile(`output_${index}.mp4`);
      } catch {
        break;
      }

      await this.ffmpeg.deleteFile(`output_${index}.mp4`);
      yield {
        blob: new Blob([(data as Uint8Array).buffer as BlobPart], {
          type: "video/mp4",
        }),
        endTime: index * segmentSeconds,
      };
      index++;
    }
  }

  async getImage(): Promise<Blob> {
    let data;
    const fileName = `frame_${Date.now()}.jpg`;
    await this.ffmpeg.exec([
      "-noaccurate_seek",
      "-i",
      this.videoFileName,
      "-frames:v",
      "1",
      "-q:v",
      "1",
      "-f",
      "image2",
      "-update",
      "1",
      fileName,
    ]);
    console.log("exec sucessfull");
    try {
      data = await this.ffmpeg.readFile(fileName);
      console.log("sikeres kép");
      await this.ffmpeg.deleteFile(fileName);
    } catch (e) {
      console.error("Hiba a kép fájl olvasásakor:", e);
      throw e;
    }
    return new Blob([(data as Uint8Array).buffer as BlobPart], { type: "image/jpeg" });
  }
}
