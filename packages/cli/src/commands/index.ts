import { cac } from "cac";
import { initCommand } from "./init.js";
import { statusCommand } from "./status.js";
import { commitSessionCommand } from "./commit-session.js";
import { searchCommand } from "./search.js";
import { resumeCommand } from "./resume.js";
import { handoffCommand } from "./handoff.js";
import { pinCommand } from "./pin.js";
import { invalidateCommand } from "./invalidate.js";
import { supersedeCommand } from "./supersede.js";
import { tasksCommand } from "./tasks.js";
import { branchContextCommand } from "./branch-context.js";
import { installTemplateCommand } from "./install-template.js";

export const cli = cac("ctx");

initCommand(cli);
statusCommand(cli);
commitSessionCommand(cli);
searchCommand(cli);
resumeCommand(cli);
handoffCommand(cli);
pinCommand(cli);
invalidateCommand(cli);
supersedeCommand(cli);
tasksCommand(cli);
branchContextCommand(cli);
installTemplateCommand(cli);

cli.version("0.1.0");
cli.help();