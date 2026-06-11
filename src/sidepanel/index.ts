import "./styles.css";
import { createBrowserDependencies } from "./browser-deps";
import { destroyActiveLanguageModelSession } from "../ai/language-model";
import { SidePanelModel } from "./model";
import { render } from "./view";

const status = document.querySelector<HTMLElement>("#status");
const action = document.querySelector<HTMLButtonElement>("#primary-action");
if (!status || !action) throw new Error("side-panel-dom-missing");

const model = new SidePanelModel(createBrowserDependencies((state) =>
  render(state, { status, action }),
));
action.addEventListener("click", () => void model.prepareAndRun());
window.addEventListener("pagehide", destroyActiveLanguageModelSession);
void model.initialize();
