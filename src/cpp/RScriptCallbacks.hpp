/*
 * RScriptCallbacks.hpp
 *
 * Copyright (C) 2021 by RStudio, PBC
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

#ifndef R_SESSION_SCRIPT_CALLBACKS_HPP
#define R_SESSION_SCRIPT_CALLBACKS_HPP

namespace rstudio {
namespace r {
namespace session {

void setRunScript(const std::string& runScript);

int RReadScript (const char *pmt, CONSOLE_BUFFER_CHAR* buf, int buflen, int hist);

void RWriteStdout (const char *buf, int buflen, int otype);


} // namespace session
} // namespace r
} // namespace rstudio

#endif // R_SESSION_SCRIPT_CALLBACKS_HPP 