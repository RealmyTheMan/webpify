#!/usr/bin/env bun

import "colors";
import { program } from "commander";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";

const WORKING_DIRECTORY = process.cwd();
const ACCEPTED_FILE_REGEX = /\.(jpe?g|png|gif|bmp|tiff|webp|avif)$/i;

console.log(`webpinator`.cyan.bold);

program
  .name("webpinator")
  .description(
    "A CLI tool to convert convert a directory of image files to WEBP."
  )
  .option(
    "-i, --input <string>",
    "The input directory (defaults to current working directory)"
  )
  .option(
    "-o, --output <string>",
    "The output directory (defaults to `[input dir]/output`)"
  )
  .option(
    "-q, --quality <string>",
    "The resulting quality of the WEBP file. Can be 1-101, and defaults to `101` (special value meaning lossless)."
  )
  .option(
    "-r, --recursive",
    "Whether to also convert the files in any sub-folders"
  )
  .action(
    async (opts: {
      input?: string;
      output?: string;
      quality?: string;
      recursive?: boolean;
    }) => {
      const inputDir = opts.input || WORKING_DIRECTORY;
      const outputDir = opts.output || path.join(inputDir, "output");

      const qualityNum =
        opts.quality && !isNaN(parseInt(opts.quality))
          ? parseInt(opts.quality)
          : 101;
      const quality = qualityNum < 1 || qualityNum > 101 ? 101 : qualityNum;

      if (
        !(await fs.exists(inputDir)) ||
        !(await fs.exists(path.dirname(outputDir)))
      )
        userErrorOut(
          "The input or (parent of) output directory doesn't exist."
        );

      console.log(
        `Converting all image files in "${inputDir.bold}" to WEBP in "${
          outputDir.bold
        }" with quality ${
          quality === 101 ? "lossless".bold : quality.toString().bold
        }`.blue
      );

      const entries = await fs.readdir(inputDir, {
        recursive: !!opts.recursive,
        withFileTypes: true,
      });
      const images: string[] = [];

      for (const i in entries) {
        const entry = entries[i]!;
        if (entry.isFile() && ACCEPTED_FILE_REGEX.test(entry.name)) {
          images.push(path.join(entry.parentPath, entry.name));
        }
      }

      if (images.length === 0)
        userErrorOut(
          "No image files were found. Do any files in your input directory end with a valid image format? (jp(e)g, png, gif, bmp, tiff, webp, avif)"
        );

      console.log(`Found ${images.length} image files`.blue.bold);

      if (!(await fs.exists(outputDir))) await fs.mkdir(outputDir);
      let conversions = 0;

      for (const image of images) {
        const basename = path.parse(image).name;
        let filename = basename;
        let copy = 1;

        while (true) {
          if (await fs.exists(path.join(outputDir, filename + ".webp"))) {
            filename = basename + "-" + copy;
            copy++;
          } else break;
        }

        try {
          console.log(`Processing "${path.basename(image).bold}"`);

          await sharp(image)
            .trim({
              threshold: 0,
              background: { r: 128, g: 128, b: 128, alpha: 0 },
            })
            .webp({ ...(quality === 101 ? { lossless: true } : { quality }) })
            .toFile(path.join(outputDir, filename + ".webp"));

          conversions++;
        } catch (err) {
          console.error(
            `Error occured on "${path.basename(image).bold}":`.red,
            err
          );
        }
      }

      console.log(
        `Successfully converted ${conversions} out of ${images.length} files.`
          .green.bold
      );
    }
  );

program.parse();

function userErrorOut(message: string) {
  console.error(message.red.bold);
  process.exit(1);
}
