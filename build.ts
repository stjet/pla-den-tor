import * as path from 'path';
import { readdirSync } from 'fs';
import { Renderer } from './ryuji.js';
import { Builder } from './saki.js';
import _host_info from './host_info.json';

//todo: music?

interface Listing {
  name: string;
  type: "anime" | "manga";
}

interface DirectoryVars {
  listing: Listing;
  chapters: string[]; //name of all the chapters
}

interface AnimeVars {
  listing: Listing;
  chapter: string;
  next_chapter?: string | boolean;
  prev_chapter?: string | boolean;
}

interface MangaVars {
  listing: Listing;
  chapter: string;
  images: string[]; //file names of all the images in the chapter
  next_chapter?: string | boolean;
  prev_chapter?: string | boolean;
}

const listings: Listing[] = _host_info.listings.filter((listing: any): listing is Listing => typeof listing.name === "string" && (listing?.type === "anime" || listing?.type === "manga"));

let renderer: Renderer = new Renderer("templates", "components");
let builder: Builder;
if (process.argv[2] === "--quick") {
  builder = new Builder("/build", ["anime_assets", "manga_assets", "password"]); //password is included since it is static
} else {
  builder = new Builder();
}

//static page
if (process.argv[2] !== "--quick") {
  builder.serve_static_folder("static");
}

//main page
builder.serve_template(renderer, "/", "index", {
  listings,
});

//directories, anime, manga
let directory_serve_paths: string[] = [];
let directory_vars: DirectoryVars[] = [];

let anime_serve_paths: string[] = [];
let anime_vars: AnimeVars[] = [];

let manga_serve_paths: string[] = [];
let manga_vars: MangaVars[] = [];

for (let i = 0; i < listings.length; i++) {
  const listing: Listing = listings[i];
  directory_serve_paths.push(`/${listing.type}/${listing.name}`);
  const chapters: string[] = readdirSync(path.join(__dirname, `/static/${listing.type}_assets/${listing.name}`), { withFileTypes: true }).map((d) => d.name.replace(".mp4", ""));
  directory_vars.push({
    listing,
    chapters,
  });
  if (listing.type === "anime") {
    for (let j = 0; j < chapters.length; j++) {
      const chapter: string = chapters[j];
      anime_serve_paths.push(`/${listing.type}/${listing.name}/${chapter}`);
      anime_vars.push({
        listing,
        chapter,
        next_chapter: chapters[j + 1] ? chapters[j + 1] : false,
        prev_chapter: j > 0 ? chapters[j - 1] : false,
      });
    }
  } else if (listing.type === "manga") {
    for (let j = 0; j < chapters.length; j++) {
      const chapter: string = chapters[j];
      manga_serve_paths.push(`/${listing.type}/${listing.name}/${chapter}`);
      const images: string[] = readdirSync(path.join(__dirname, `/static/${listing.type}_assets/${listing.name}/${chapter}`), { withFileTypes: true }).map((d) => d.name);
      manga_vars.push({
        listing,
        chapter,
        images,
        next_chapter: chapters[j + 1] ? chapters[j + 1] : false,
        prev_chapter: j > 0 ? chapters[j - 1] : false,
      });
    }
  }
}

builder.serve_templates(renderer, directory_serve_paths, "directory", directory_vars);
builder.serve_templates(renderer, anime_serve_paths, "anime", anime_vars);
builder.serve_templates(renderer, manga_serve_paths, "manga", manga_vars);
