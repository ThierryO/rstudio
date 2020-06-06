/*
 * completion.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 * Unless you have received this program directly from RStudio pursuant
 * to the terms of a commercial license agreement with RStudio, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { Node as ProsemirrorNode } from 'prosemirror-model';
import { Plugin, PluginKey, Transaction, Selection, TextSelection,} from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { setTextSelection } from 'prosemirror-utils';

import { CompletionHandler, CompletionResult, selectionAllowsCompletions, kCompletionDefaultMaxVisible } from '../../api/completion';
import { EditorEvents } from '../../api/events';
import { ScrollEvent } from '../../api/event-types';

import { renderCompletionPopup, createCompletionPopup, destroyCompletionPopup } from './completion-popup';
import { canInsertNode } from '../../api/node';


export function completionExtension(handlers: readonly CompletionHandler[], events: EditorEvents) {
  return {
    plugins: () => [new CompletionPlugin(handlers, events)]
  };
}

interface CompletionState {
  handler?: CompletionHandler;
  result?: CompletionResult;
}

const key = new PluginKey<CompletionState>('completion');

class CompletionPlugin extends Plugin<CompletionState> {
  
  // editor view
  private view: EditorView | null = null;

  // popup elemeent
  private readonly completionPopup: HTMLElement;

  // currently selected index and last set of completions are held as transient
  // state because they can't be derived from the document state (selectedIndex 
  // is derived from out of band user keyboard gestures and completions may 
  // have required fulfilling an external promise). also use a version counter
  // used to invalidate async completion requests that are fulfilled after
  // an update has occurred
  private version = 0;
  private completions: any[] = [];
  private selectedIndex = 0;

  // events we need to unsubscribe from
  private readonly scrollUnsubscribe: VoidFunction;

  constructor(handlers: readonly CompletionHandler[], events: EditorEvents) {
    super({
      key,
      state: {

        init: () => ({}),
        apply: (tr: Transaction)  => {

          // if we don't have a view then bail
          if (!this.view) {
            return {};
          }

          // selection only changes dismiss any active completion
          if (!tr.docChanged && tr.selectionSet) {
            return {};
          }

          // check whether completions are valid here
          if (!selectionAllowsCompletions(tr.selection)) {
            return {};
          }
          
          // calcluate text before cursor
          const textBefore = completionTextBeforeCursor(tr.selection);

          // if there is no text then don't handle it
          if (textBefore.length === 0) {
            return {};
          }

          // check for a handler that can provide completions at the current selection
          for (const handler of handlers) {
            const result = handler.completions(textBefore, tr.doc, tr.selection);
            if (result) {
              return { handler, result };
            }
          }

          // no handler found
          return {};
        }
      },
      
      view: () => ({
        update: (view: EditorView) => {

          // set view
          this.view = view;
          
          // clear completion state
          this.clearCompletions();
         
          // increment version
          this.version++;

          // render and show completions if we have them
          this.updateCompletions(view).then(this.showCompletionPopup);
        
        },

        destroy: () => {

          // unsubscribe from events
          this.scrollUnsubscribe();
          window.document.removeEventListener('focusin', this.hideCompletionPopup);

          // tear down the popup
          destroyCompletionPopup(this.completionPopup);

        },
      }),

      props: {
        handleDOMEvents: {
          keydown: (view: EditorView, event: Event) => {
            const kbEvent = event as KeyboardEvent;

            let handled = false;

            if (this.completionsActive()) {
              switch(kbEvent.key) {
                case 'Escape':
                  this.dismissCompletions();
                  handled = true;
                  break;
                case 'Enter':
                  this.insertCompletion(view, this.selectedIndex);
                  handled = true;
                  break;
                case 'ArrowUp':
                  this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                  this.renderCompletions(view);
                  handled = true;
                  break;
                case 'ArrowDown':
                  this.selectedIndex = Math.min(this.selectedIndex + 1, this.completions.length - 1);
                  this.renderCompletions(view);
                  handled = true;
                  break;
                case 'PageUp':
                  this.selectedIndex = Math.max(this.selectedIndex - this.completionPageSize(), 0);
                  this.renderCompletions(view);
                  handled = true;
                  break;
                case 'PageDown':
                  this.selectedIndex = Math.min(this.selectedIndex + this.completionPageSize(), this.completions.length - 1);
                  this.renderCompletions(view);
                  handled = true;
                  break;
              }
            }
            
            // supress event if we handled it
            if (handled) {
              event.preventDefault();
              event.stopPropagation();
            }

            // return status
            return handled;
          }
        }
      }
    });

    // bind callback methods
    this.showCompletionPopup = this.showCompletionPopup.bind(this);
    this.hideCompletionPopup = this.hideCompletionPopup.bind(this);
   
    // hide completions when we scroll or the focus changes
    this.scrollUnsubscribe = events.subscribe(ScrollEvent, this.hideCompletionPopup);
    window.document.addEventListener('focusin', this.hideCompletionPopup);

    // create the popup, add it, and make it initially hidden
    this.completionPopup = createCompletionPopup();
    window.document.body.appendChild(this.completionPopup);
    this.hideCompletionPopup();
  }

  private updateCompletions(view: EditorView) : Promise<boolean> {

    const state = key.getState(view.state);
    
    if (state?.handler) {
  
      // track the request version to invalidate the result if an
      // update happens after it goes into flight
      const requestVersion = this.version;

      // request completions
      return state.result!.completions(view.state).then(completions => {

        // if the version has incremented since the request then return false
        if (this.version !== requestVersion) {
          return false;
        }
         
        // save completions 
        this.selectedIndex = 0;
        this.completions = completions;

        // render them
        return this.renderCompletions(view);

      });
     
    } else {
      return Promise.resolve(false);
    }
  }

  private renderCompletions(view: EditorView) {

    const state = key.getState(view.state);

    if (state?.handler && this.completions.length > 0) {
      const props = {
        handler: state.handler!,
        pos: state.result!.pos,
        completions: this.completions,
        selectedIndex: this.selectedIndex,
        onClick: (index: number) => {
          this.insertCompletion(view, index);
        },
        onHover: (index: number) => {
          this.selectedIndex = index;
          this.renderCompletions(view);
        }
      };
      renderCompletionPopup(view, props, this.completionPopup);
      return true;
    } else {
      return false;
    }
  }

  private insertCompletion(view: EditorView, index: number) {

    // default index if not specified
    index = index || this.selectedIndex;

    const state = key.getState(view.state);
    if (state && state.handler) {
        
      // perform replacement 
      const result = state.result!;

      // check low level handler first
      if (state.handler.replace) {

        // execute replace
        state.handler.replace(view, result.pos, this.completions[index]);
    
      // use higher level handler
      } else if (state.handler.replacement) {

        // get replacement from handler
        const replacement = state.handler.replacement(view.state.schema, this.completions[index]);
        if (replacement) {

          // ensure we have a node
          const node = replacement instanceof ProsemirrorNode ? replacement : view.state.schema.text(replacement);

          // perform replacement
          const tr = view.state.tr;
          tr.setSelection(new TextSelection(tr.doc.resolve(result.pos), view.state.selection.$head));
          tr.replaceSelectionWith(node, true);
          setTextSelection(tr.selection.to)(tr);
          view.dispatch(tr);
        }
        

      }

      // set focus
      view.focus();
    }

    this.hideCompletionPopup();

  }

  // explicit user dismiss of completion (e.g. Esc key)
  private dismissCompletions() {
    
    // call lower-level replace on any active handler (w/ null). this gives
    // them a chance to dismiss any artifacts that were explicitly inserted
    // to trigger the handler (e.g. a cmd+/ for omni-insert)
    if (this.view) {
      const state = key.getState(this.view.state);
      if (state?.result && state.handler) {
        if (state.handler.replace) {
          state.handler.replace(this.view, state.result.pos, null);
        } else if (state.handler.replacement) {
          state.handler.replacement(this.view.state.schema, null);
        }
      }
    }

    this.hideCompletionPopup();
  }

  private showCompletionPopup(show: boolean) {
    this.completionPopup.style.display =  show ? '' : 'none';
  }

  private hideCompletionPopup() {
    this.clearCompletions();
    this.showCompletionPopup(false);
  }

  private completionsActive() {
    return this.completionPopup.style.display !== 'none';
  }

  private clearCompletions() {
    this.selectedIndex = 0;
    this.completions = [];
  }

  private completionPageSize() {
    if (this.view) {
      const state = key.getState(this.view.state);
      return state?.handler?.view.maxVisible || kCompletionDefaultMaxVisible;
    } else {
      return kCompletionDefaultMaxVisible;
    }
  }
}


// extract the text before the cursor, dealing with block separators and
// non-text leaf chracters (this is based on code in prosemirror-inputrules)
function completionTextBeforeCursor(selection: Selection, maxLength = 500) {
  const { $head } = selection;
  return $head.parent.textBetween(
    Math.max(0, $head.parentOffset - maxLength),  // start
    $head.parentOffset,                           // end
    undefined,                                    // block separator
    "\ufffc"                                      // leaf char
  );   
}
