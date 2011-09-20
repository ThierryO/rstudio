/*
 * ConsoleOutputEvent.java
 *
 * Copyright (C) 2009-11 by RStudio, Inc.
 *
 * This program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */
package org.rstudio.studio.client.common.console;

import com.google.gwt.event.shared.EventHandler;
import com.google.gwt.event.shared.GwtEvent;
import com.google.gwt.event.shared.HandlerRegistration;
import com.google.gwt.event.shared.HasHandlers;
import org.rstudio.studio.client.common.console.ConsoleOutputEvent.Handler;

public class ConsoleOutputEvent extends GwtEvent<Handler>
{
   public interface Handler extends EventHandler
   {
      void onConsoleOutput(ConsoleOutputEvent event);
   }

   public interface HasHandlers extends com.google.gwt.event.shared.HasHandlers
   {
      HandlerRegistration addConsoleOutputHandler(Handler handler);
   }

   public ConsoleOutputEvent(String output, boolean error)
   {
      output_ = output;
      error_ = error;
   }

   public String getOutput()
   {
      return output_;
   }

   public boolean isError()
   {
      return error_;
   }

   @Override
   public Type<Handler> getAssociatedType()
   {
      return TYPE;
   }

   @Override
   protected void dispatch(Handler handler)
   {
      handler.onConsoleOutput(this);
   }

   private final String output_;
   private final boolean error_;

   public static final Type<Handler> TYPE = new Type<Handler>();
}
