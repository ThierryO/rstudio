/*
 * ResizeGripper.java
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
package org.rstudio.core.client.widget;


import com.google.gwt.core.client.GWT;
import com.google.gwt.resources.client.ClientBundle;
import com.google.gwt.resources.client.CssResource;
import com.google.gwt.resources.client.ImageResource;
import com.google.gwt.user.client.DOM;
import com.google.gwt.user.client.Event;
import com.google.gwt.user.client.ui.Composite;
import com.google.gwt.user.client.ui.Image;


public class ResizeGripper extends Composite
{
   public interface Observer
   {
      void onResizing(int xDelta, int yDelta);
      void onResizingCompleted();
   }
   
   public ResizeGripper(Observer observer)
   {   
      observer_ = observer;
      gripperImageResource_ = RESOURCES.resizeGripper();
      Image image = new Image(gripperImageResource_);
      initWidget(image);
      setStylePrimaryName(RESOURCES.styles().resizeGripper());
      
      
      DOM.sinkEvents(getElement(), 
                     Event.ONMOUSEDOWN | 
                     Event.ONMOUSEMOVE | 
                     Event.ONMOUSEUP);
   }
   
   public int getImageWidth()
   {
      return gripperImageResource_.getWidth();
   }
   
   public int getImageHeight()
   {
      return gripperImageResource_.getHeight();
   }
 
   @Override
   public void onBrowserEvent(Event event) 
   {
      event.preventDefault();
      event.stopPropagation();

      final int eventType = DOM.eventGetType(event);
      
      if (Event.ONMOUSEDOWN == eventType)
      {
         sizing_ = true;
         lastX_ = DOM.eventGetClientX(event);
         lastY_ = DOM.eventGetClientY(event);
         DOM.setCapture(getElement());
      }
      else if (Event.ONMOUSEMOVE == eventType)
      {
         if (sizing_)
         {     
            DOM.setCapture(getElement());
            
            int x = DOM.eventGetClientX(event);
            int y = DOM.eventGetClientY(event);
            int xDelta = x - lastX_;
            int yDelta = y - lastY_;
            
            observer_.onResizing(xDelta, yDelta);
            
            lastX_ = DOM.eventGetClientX(event);
            lastY_ = DOM.eventGetClientY(event);
            
            event.stopPropagation();
         }
      }
      else if (Event.ONMOUSEUP == eventType)
      {
         if (sizing_)
         {
            sizing_ = false;
            lastX_ = 0;
            lastY_ = 0;
            observer_.onResizingCompleted();
         }
         DOM.releaseCapture(getElement());
      }
   }
   
   
   interface Styles extends CssResource
   {
      String resizeGripper();
   }
   
   interface Resources extends ClientBundle
   {
      @Source("ResizeGripper.css")
      Styles styles();

      ImageResource resizeGripper();
   }
   
   static Resources RESOURCES = (Resources)GWT.create(Resources.class);
   public static void ensureStylesInjected() 
   {
      RESOURCES.styles().ensureInjected();
   }
   
   private final ImageResource gripperImageResource_;
   private final Observer observer_;
   
   private boolean sizing_ = false;
   private int lastX_ = 0;
   private int lastY_ = 0;
   

}
