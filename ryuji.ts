import { readFileSync } from 'fs';

export const SYNTAX_REGEX = /\[\[ [a-zA-Z0-9.:/\-_!]+ \]\]/g;

export type file_extension = `.${string}`;

export interface ForLoopInfo {
  index: number,
  total: number,
  current: number,
  var_value: any, //value we are looping over
  iter_var_name?: string,
  index_var_name?: string,
}

export class Renderer {
  templates_dir: string;
  components_dir: string;
  file_extension: file_extension;

  constructor(templates_dir: string, components_dir: string, file_extension: file_extension=".html") {
    this.templates_dir = templates_dir;
    this.components_dir = components_dir;
    this.file_extension = file_extension
  }

  static remove_empty_lines(text: string): string {
    let lines: string[] = text.split("\n");
    let new_lines: string[] = [];
    for (let i=0; i < lines.length; i++) {
      if (lines[i].trim() === "") continue;
      new_lines.push(lines[i]);
    }
    return new_lines.join("\n");
  }

  static concat_path(path1: string, path2: string): string {
    if (path1.endsWith("/") && path2.startsWith("/")) {
      return `${path1.slice(0, path1.length-1)}${path2}`;
    } else if ((!path1.endsWith("/") && path2.startsWith("/")) || (path1.endsWith("/") && !path2.startsWith("/"))) {
      return `${path1}${path2}`;
    } else if (!path1.endsWith("/") && !path2.startsWith("/")) {
      return `${path1}/${path2}`;
    }
  }

  static sanitize(non_html: string): string {
    return non_html.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  static check_var_name_legality(var_name: string, dot_allowed: boolean=true) {
    //I try to avoid regex if I can
    let legal_chars: string[] = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "_", "."];
    if (!dot_allowed) legal_chars.pop();
    let legal_var_name: boolean = var_name.toLowerCase().split("").every((char) => legal_chars.includes(char));
    if (!legal_var_name) throw Error(`Variable name "${var_name}" has illegal characters`);
  }

  static get_var(var_name: string, vars?: any): any { //probably a string but guarantee
    if (typeof vars === "undefined") throw Error(`Variable "${var_name}" is undefined`);
    Renderer.check_var_name_legality(var_name);
    let splitted: string[] = var_name.split(".")
    let var_value = vars;
    for (let i=0; i < splitted.length; i++) {
      var_value = var_value?.[splitted[i]];
    }
    if (typeof var_value === "undefined") throw Error(`Variable "${var_name}" is undefined`);
    return var_value;
  }

  render(template_contents: string, vars?: any, recursion_layer: number=0): string {
    let matches = [...template_contents.matchAll(SYNTAX_REGEX)];
    if (matches.length === 0) {
      return template_contents;
    }
    let _iterations: number = 0;
    let rendered: string = template_contents.slice(0, matches[0].index);
    let index: number = 0;
    let for_loops: ForLoopInfo[] = [];
    //let offset: number = 0; //I guess we don't need the offset
    while (true) {
      if (index === matches.length) break;
      if (_iterations > 75000) console.log("Passed 75000 iterations while rendering, infinite loop?");
      let match = matches[index];
      //[[ content ]]
      let exp_parts = match[0].slice(3, match[0].length-3).split(":");
      if (exp_parts[0] === "component") {
        //we do not want get into an infinite recursion loop with components referring to each other
        if (recursion_layer > 5) throw Error("Components more than 5 layers deep, components may be referencing each other in infinite loop.");
        if (typeof exp_parts[1] !== "string") throw Error("`component:` statement missing component file name afterwards");
        let file_name: string = exp_parts[1];
	if (!file_name.includes(".")) {
	  file_name += this.file_extension;
	}
	rendered += this.render_template(Renderer.concat_path(this.components_dir, file_name), vars, recursion_layer+1);
      } else if (exp_parts[0] === "for") {
        if (for_loops[for_loops.length-1]?.index === index) {
          //for loop already exists, just continue and do nothing
        } else {
          //variables in for loops are not scoped because that would be too much work
          if (typeof exp_parts[1] !== "string") throw Error("`for:` statement missing variable name to loop over afterwards");
          let var_name: string = exp_parts[1];
          let var_value = Renderer.get_var(var_name, vars);
          //set iter variable (optional) (you know, the "post" in "for post in posts")
          //(I don't know what the actual name of that thing is)
          if (typeof exp_parts[2] === "string") {
            let iter_var_name: string = exp_parts[2];
            Renderer.check_var_name_legality(iter_var_name, false);
            vars[iter_var_name] = var_value[0];
          }
          if (typeof exp_parts[3] === "string") {
            //set index count
            let index_var_name: string = exp_parts[3];
            Renderer.check_var_name_legality(index_var_name, false);
            vars[index_var_name] = 0;
          }
          if (typeof exp_parts[4] === "string") {
            //set max count
            let max_var_name: string = exp_parts[4];
            Renderer.check_var_name_legality(max_var_name, false);
            vars[max_var_name] = var_value.length-1;
          }
          //add to for loops
          for_loops.push({
            index,
            total: var_value.length,
            current: 0,
            var_value,
            iter_var_name: exp_parts[2],
            index_var_name: exp_parts[3],
          });
          //make sure thing we are iterating over isn't empty
          if (var_value.length === 0) {
            //skip straight to the endfor
            let sliced = matches.slice(index+1, matches.length);
            let new_index: number;
            let extra_fors: number = 0;
            for (let i=0; i < sliced.length; i++) {
              if (sliced[i][0].startsWith("[[ for:")) {
                extra_fors++;
              } else if (sliced[i][0] === "[[ endfor ]]") {
                if (extra_fors === 0) {
                  new_index = i;
                  break;
                }
                extra_fors--;
              }
            }
            if (typeof new_index === "undefined") throw Error("`for:` statement missing an `[[ endfor ]]`");
            index += new_index+1;
            continue;
          }
        }
      } else if (exp_parts[0] === "endfor") {
        //check if for loop is over, if not, go back to for
        let current_loop: ForLoopInfo = for_loops[for_loops.length-1];
        current_loop.current++;
        if (current_loop.current >= current_loop.total) {
          //for loop ended, onwards! oh yeah, also remove the current for loop info
          for_loops.pop();
        } else {
          //update iter var
          if (current_loop.iter_var_name) {
            vars[current_loop.iter_var_name] = current_loop.var_value[current_loop.current];
          }
          if (current_loop.index_var_name) {
            vars[current_loop.index_var_name] = current_loop.current;
          }
          //go back to start of for loop index
          index = current_loop.index;
          continue;
        }
      } else if (exp_parts[0] === "if") {
        if (typeof exp_parts[1] !== "string") throw Error("`if:` statement missing variable name afterwards");
        let var_name: string = exp_parts[1];
        let var_value = Renderer.get_var(var_name, vars);
        let condition_pass: boolean;
        if (typeof exp_parts[2] !== "string") {
          //make sure var is truthy
          if (var_value) {
            condition_pass = true;
          } else {
            condition_pass = false;
          }
        } else {
          //compare with second var
          let var_name2: string = exp_parts[2];
          let if_not: boolean = false;
          if (var_name2.startsWith("!")) {
            var_name2 = var_name2.slice(1, var_name2.length);
            if_not = true;
          }
          let var_value2 = Renderer.get_var(var_name2, vars);
          if (if_not) {
            //make sure the two compared variables are NOT equal
            if (var_value !== var_value2) {
              condition_pass = true;
            } else {
              condition_pass = false;
            }
          } else {
            //regular comparison statement
            if (var_value === var_value2) {
              condition_pass = true;
            } else {
              condition_pass = false;
            }
          }
        }
        if (!condition_pass) { //failed condition
          //skip to the endif
          let sliced = matches.slice(index+1, matches.length);
          let new_index: number;
          let extra_ifs: number = 0;
          for (let i=0; i < sliced.length; i++) {
            if (sliced[i][0].startsWith("[[ if:")) {
              extra_ifs++;
            } else if (sliced[i][0] === "[[ endif ]]") {
              if (extra_ifs === 0) {
                new_index = i;
                break;
              }
              extra_ifs--;
            }
          }
          if (typeof new_index === "undefined") throw Error("`if:` statement missing an `[[ endif ]]`");
          index += new_index+1;
          continue;
        }
      } else if (exp_parts[0] === "endif") {
        //yup, nothing here
      } else { //html:<variable name> or <variable name>
        //variable
        let var_name: string;
        if (exp_parts[0] === "html") {
          if (typeof exp_parts[1] !== "string") throw Error("`html:` statement missing variable name afterwards");
          var_name = exp_parts[1];
        } else {
          var_name = exp_parts[0];
        }
        //convert to string
        let var_value: string = String(Renderer.get_var(var_name, vars));
        //add indentation
        let current_lines: string[] = rendered.split("\n");
        let current_last: string = current_lines[current_lines.length-1];
        let indentation: number = 0;
        for (let i=0; i < current_last.length; i++) {
          if (current_last[i] !== " ") break;
          indentation++;
        }
        let var_lines: string[] = var_value.split("\n");
        let var_first: string = var_lines.shift();
        //append spaces
        var_value = var_lines.length === 0 ? var_first : var_first+"\n"+var_lines.map((var_line) => " ".repeat(indentation)+var_line).join("\n");
        if (exp_parts[0] === "html") {
          //variable but not sanitized
          rendered += var_value;
        } else {
          rendered += Renderer.sanitize(var_value);
        }
      }
      //add the html that comes after this, up until the next template syntax match thing
      rendered += template_contents.slice(match.index+match[0].length, matches[index+1]?.index ? matches[index+1].index : template_contents.length);
      index++;
      _iterations++;
    }
    return rendered;
  }

  render_template(template_name: string, vars?: any, recursion_layer: number=0): string {
    if (!template_name.includes(".")) {
      template_name += this.file_extension;
    }
    let path_to_template: string = Renderer.concat_path(this.templates_dir, template_name);
    const template_contents: string = readFileSync(path_to_template, "utf-8");
    return this.render(template_contents, vars, recursion_layer);
  }
}
