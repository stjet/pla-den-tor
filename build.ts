import * as path from 'path';
import { readdirSync } from 'fs';
import { Renderer } from './ryuji.js';
import { Builder } from './saki.js';
import _host_info from './host_info.json';

//todo: music?

interface Listing {
  name: string;
  type: "anime" | "manga" | "music";
  favourites: {
    listing: boolean; //whether to mark entire listing as favourite
    chapters: string[]; //favourite chapters
  }; //marked as not optional here, but in the actual host_info.json file, it is optional
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

type MusicVars = AnimeVars;

interface MangaVars {
  listing: Listing;
  chapter: string;
  images: string[]; //file names of all the images in the chapter
  next_chapter?: string | boolean;
  prev_chapter?: string | boolean;
}

const listings: Listing[] = _host_info.listings.map(
  (listing: any) =>
    //add empty "favourites" if not present in the json
    listing.favourites ? listing : {
      ...listing,
      favourites: {
        listing: false,
        chapters: []
      }
    }
).filter(
  (listing: any): listing is Listing =>
    typeof listing.name === "string" && (listing?.type === "anime" || listing?.type === "manga" || listing?.type === "music")
);

let renderer: Renderer = new Renderer("templates", "components");
let builder: Builder = new Builder("/build");

//static page
builder.serve_static_folder("static");

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

let music_serve_paths: string[] = [];
let music_vars: MusicVars[] = [];

let songs: string[] = [];
let manga_pages_count: number = 0;

for (let i = 0; i < listings.length; i++) {
  const listing: Listing = listings[i];
  directory_serve_paths.push(`/${listing.type}/${listing.name}`);
  const chapters: string[] = readdirSync(path.join(__dirname, `/static_assets/${listing.type}_assets/${listing.name}`), { withFileTypes: true }).map((d) => d.name.replace(".mp4", "").replace(".mp3", ""));
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
      const images: string[] = readdirSync(path.join(__dirname, `/static_assets/${listing.type}_assets/${listing.name}/${chapter}`), { withFileTypes: true }).map((d) => d.name);
      manga_pages_count += images.length;
      manga_vars.push({
        listing,
        chapter,
        images,
        next_chapter: chapters[j + 1] ? chapters[j + 1] : false,
        prev_chapter: j > 0 ? chapters[j - 1] : false,
      });
    }
  } else if (listing.type === "music") {
    for (let j = 0; j < chapters.length; j++) {
      const chapter: string = chapters[j];
      songs.push(`${listing.name}/${chapter}`);
      music_serve_paths.push(`/${listing.type}/${listing.name}/${chapter}`);
      music_vars.push({
        listing,
        chapter,
        next_chapter: chapters[j + 1] ? chapters[j + 1] : false,
        prev_chapter: j > 0 ? chapters[j - 1] : false,
      });
    }
  }
}

builder.serve_templates(renderer, directory_serve_paths, "directory", directory_vars);
builder.serve_templates(renderer, anime_serve_paths, "anime", anime_vars);
builder.serve_templates(renderer, manga_serve_paths, "manga", manga_vars);
builder.serve_templates(renderer, music_serve_paths, "music", music_vars);

builder.serve_template(renderer, "/stats", "stats", {
  manga_series_count: listings.filter((l) => l.type === "manga").length,
  manga_chapters_count: manga_serve_paths.length,
  manga_pages_count,
  anime_series_count: listings.filter((l) => l.type === "anime").length,
  anime_episodes_count: anime_serve_paths.length,
  artists_count: listings.filter((l) => l.type === "music").length,
  songs_count: songs.length,
});

builder.serve_template(renderer, "/player", "player", {
  songs,
  artists: listings.filter((l) => l.type === "music").map(
    (l) => (
      {
        name: l.name,
        sanitized_name: l.name.replaceAll("\"", "\\\""),
        songs: songs.filter((s) => s.startsWith(`${l.name}/`)).map(
          (song) => (
            {
              name: song.slice(`${l.name}/`.length),
              //I don't think " can be in file names... but just in case
              sanitized_name: song.slice(`${l.name}/`.length).replaceAll("\"", "\\\""),
              favourite: l.favourites.chapters.includes(song.slice(`${l.name}/`.length)),
            }
          )
        ),
        favourite: l.favourites.listing,
      }
    )
  ),
});
