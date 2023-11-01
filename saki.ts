import * as path from 'path';
import { copyFileSync, existsSync, readdirSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import type { Renderer } from './ryuji.js';

export class Builder {
  build_dir: string;
  ignore?: string[]; //top level directories/files to not wipe

  constructor(build_dir: string="/build", ignore?: string[]) {
    this.build_dir = path.join(__dirname, build_dir);
    this.ignore = ignore;
    if (existsSync(this.build_dir)) {
      //wipe the build directory
      if (!this.ignore || this.ignore?.length === 0) {
        rmSync(this.build_dir, {
          recursive: true,
        });
      } else {
        //do not wipe certain directories/files
        readdirSync(this.build_dir).forEach((member: string) => {
          if (!this.ignore.includes(member)) {
            rmSync(path.join(this.build_dir, member), {
              recursive: true,
            });
          }
        });
      }
    }
    if (!this.ignore || this.ignore?.length === 0) {
      mkdirSync(this.build_dir);
    }
  }

  static copy_folder(folder_path: string, dest_path: string) {
    let children: string[] = readdirSync(folder_path);
    for (let i=0; i < children.length; i++) {
      let child: string = children[i];
      let child_path: string = path.join(folder_path, child);
      let copy_path: string = path.join(dest_path, child);
      if (child.includes(".")) {
        //file
        copyFileSync(child_path, copy_path);
      } else {
        //directory, make directory and recursively copy
        mkdirSync(copy_path);
        Builder.copy_folder(child_path, path.join(dest_path, child));
      }
    }
  }

  serve_static_folder(static_dir: string, serve_from: string="/") {
    let static_path: string = path.join(__dirname, static_dir);
    let dest_path: string = path.join(this.build_dir, serve_from);
    Builder.copy_folder(static_path, dest_path);
  }

  serve_content(content: string, serve_path: string) {
    let dest_path: string = path.join(this.build_dir, serve_path);
    if (!serve_path.includes(".")) {
      //serve as index.html in serve_path directory
      //will not make a new directory if `serve_path` is "/", since the build directory already exists
      if (dest_path !== this.build_dir && dest_path !== path.join(this.build_dir, "/")) {
        mkdirSync(dest_path, {
          recursive: true,
        });
      }
      writeFileSync(path.join(dest_path, "index.html"), content);
    } else {
      //serve as file regularly
      writeFileSync(dest_path, content);
    }
  }

  serve_file(file_path: string, serve_path: string) {
    let file_content: string = readFileSync(path.join(__dirname, file_path), "utf-8");
    this.serve_content(file_content, serve_path);
  }

  serve_template(renderer: Renderer, serve_path: string, template_name: string, vars: any) {
    let content: string = renderer.render_template(template_name, vars);
    this.serve_content(content, serve_path);
  }

  serve_templates(renderer: Renderer, serve_paths: string[], template_name: string, vars_array: any[]) {
    for (let i=0; i < serve_paths.length; i++) {
      this.serve_template(renderer, serve_paths[i], template_name, vars_array[i]);
    }
  }
}
