import React, { useRef, useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import BoardItem from './BoardItem';
import zoneConfig from '../data/zone-config.json';

// Types for styled components
interface ZoneContainerProps {
  color: string;
  gradient?: string;
  borderGradient?: string;
}

const CanvasContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #f8f9fa;
  background-image: 
    radial-gradient(circle, #e0e0e0 1px, transparent 1px);
  background-size: 20px 20px;
`;

const CanvasContent = styled(motion.div)`
  width: 100%;
  height: 100%;
  position: relative;
  transform-origin: 0 0;
  /* Ensure content is not clipped */
  overflow: visible;
`;

const ZoneContainer = styled.div<ZoneContainerProps>`
  position: absolute;
  border: ${zoneConfig.settings.borderWidth}px solid ${props => props.color};
  border-radius: ${zoneConfig.settings.borderRadius}px;
  background: ${props => props.gradient || props.color};
  box-shadow: ${zoneConfig.settings.boxShadow};
  pointer-events: none;
  z-index: 1; /* Zones underneath items */
  transition: all 0.3s ease;
  
  ${zoneConfig.settings.hoverEffect && `
    &:hover {
      transform: scale(1.02);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
    }
  `}
`;

const ZoneLabel = styled.div`
  position: absolute;
  top: 8px;
  left: 8px;
  background: ${zoneConfig.settings.labelBackgroundColor};
  padding: ${zoneConfig.settings.labelPadding};
  border-radius: 8px;
  font-size: ${zoneConfig.settings.labelFontSize}px;
  font-weight: ${zoneConfig.settings.labelFontWeight};
  color: ${zoneConfig.settings.labelTextColor};
  pointer-events: none;
  z-index: 2;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const ZoomControls = styled.div`
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1000;
`;

const ZoomButton = styled.button`
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.95);
  color: #333;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 1);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const AddNoteButton = styled.button`
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
  color: white;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 12px rgba(6, 182, 212, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(6, 182, 212, 0.4);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(6, 182, 212, 0.3);
  }
`;

const DeleteButton = styled.button`
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  color: white;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 12px rgba(220, 38, 38, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(220, 38, 38, 0.4);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
  }
`;

const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
`;

const ModalContent = styled(motion.div)`
  background: white;
  border-radius: 16px;
  padding: 32px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
`;

const ModalTitle = styled.h2`
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 600;
  color: #dc2626;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ModalText = styled.p`
  margin: 0 0 12px 0;
  font-size: 16px;
  line-height: 1.6;
  color: #374151;
`;

const ModalList = styled.ul`
  margin: 12px 0;
  padding-left: 24px;
  color: #374151;
  
  li {
    margin: 6px 0;
    font-size: 15px;
  }
`;

const ModalWarning = styled.div`
  background: #fef2f2;
  border: 2px solid #fecaca;
  border-radius: 8px;
  padding: 16px;
  margin: 20px 0;
  color: #991b1b;
  font-weight: 500;
  font-size: 15px;
`;

const ModalButtons = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 24px;
  justify-content: flex-end;
`;

const ModalButton = styled.button<{ variant?: 'danger' | 'secondary' }>`
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${props => props.variant === 'danger' ? `
    background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
    color: white;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
    }
  ` : `
    background: #f3f4f6;
    color: #374151;
    
    &:hover {
      background: #e5e7eb;
    }
  `}
  
  &:active {
    transform: translateY(0);
  }
`;

const Canvas = ({
  items,
  selectedItemId,
  onUpdateItem,
  onDeleteItem,
  onSelectItem,
  onFocusRequest,
  onAddItem,
  onResetBoard,
}) => {
  // Get API base URL - use env var if set, fallback to production backend
  // In production (deployed), use the same origin; in development, use localhost
  const API_BASE_URL =
    process.env.REACT_APP_API_BASE_URL ||
    (window.location.hostname === "localhost"
      ? "http://localhost:3001"
      : window.location.origin);

  const handleAddNote = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/doctor-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '',
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Note created:', data.item.id);
        
        // Auto-focus on the newly created note after a short delay
        setTimeout(() => {
          if ((window as any).centerOnItem) {
            console.log('🎯 Auto-focusing on new note:', data.item.id);
            (window as any).centerOnItem(data.item.id, 1.0, 1200);
          }
        }, 300);
      }
    } catch (error) {
      console.error('❌ Failed to create note:', error);
    }
  }, [API_BASE_URL]);

  const handleResetBoard = useCallback(async () => {
    try {
      console.log('🗑️ Resetting board...');
      setShowResetModal(false);
      setIsDeleting(true);
      
      // Get session ID from localStorage or URL
      const sessionId = localStorage.getItem('boardSessionId') || 
                       new URLSearchParams(window.location.search).get('sessionId');
      
      if (!sessionId) {
        throw new Error('No session ID found');
      }
      
      // Fetch all board items (session-aware)
      const response = await fetch(`${API_BASE_URL}/api/board-items?sessionId=${sessionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch board items');
      }
      
      const responseData = await response.json();
      const data = responseData.items || responseData; // Handle both formats
      console.log(`📊 Found ${data.length} total items`);
      
      // Filter items to delete (exclude 'raw' and 'single-encounter' items)
      const itemsToDelete = data.filter((item: any) => {
        const id = item.id || '';
        return !id.includes('raw') && !id.includes('single-encounter');
      });
      
      console.log(`📋 After first filter: ${itemsToDelete.length} items (excluded raw/single-encounter)`);
      
      // Further filter to only delete specific item types
      const itemsToActuallyDelete = itemsToDelete.filter((item: any) => {
        const id = item.id;
        return (
          id.startsWith('enhanced') ||
          id.startsWith('item') ||
          id.startsWith('doctor-note')
        );
      });
      
      console.log(`🗑️ Deleting ${itemsToActuallyDelete.length} items...`);
      console.log('Items to delete:', itemsToActuallyDelete.map(i => i.id));
      
      // Use batch delete endpoint for better performance and no race conditions
      const itemIds = itemsToActuallyDelete.map(item => item.id);
      
      try {
        const batchDeleteResponse = await fetch(
          `${API_BASE_URL}/api/board-items/batch-delete?sessionId=${sessionId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Session-Id': sessionId
            },
            body: JSON.stringify({ itemIds })
          }
        );
        
        if (batchDeleteResponse.ok) {
          const result = await batchDeleteResponse.json();
          console.log(`✅ Batch delete complete: ${result.deletedCount} deleted, ${result.remainingCount} remaining`);
        } else {
          console.error('❌ Batch delete failed:', batchDeleteResponse.status);
        }
      } catch (error) {
        console.error('❌ Error during batch delete:', error);
      }
      
      setIsDeleting(false);
      
      // Call parent's reset board function to refresh the UI
      if (onResetBoard) {
        await onResetBoard();
      }
      
    } catch (error) {
      console.error('❌ Error resetting board:', error);
      setIsDeleting(false);
    }
  }, [API_BASE_URL, onResetBoard]);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [showResetModal, setShowResetModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ============================================================================
  // EASL IFRAME CHATBOT - COMMENTED OUT
  // See: documenatation/IFRAME_CHATBOT_RESTORATION_GUIDE.md for restoration
  // ============================================================================
  
  // // Send query to EASL iframe
  // const sendQueryToEASL = useCallback((query: string, metadata?: any) => {
  //   // Find the EASL iframe element
  //   const easlIframe = document.querySelector('[data-item-id="iframe-item-easl-interface"] iframe') as HTMLIFrameElement;
  //   
  //   if (!easlIframe || !easlIframe.contentWindow) {
  //     console.error('❌ EASL iframe not found');
  //     return;
  //   }

  //   // Send message to iframe
  //   const message = {
  //     type: 'CANVAS_QUERY',
  //     payload: {
  //       query: query,
  //       timestamp: new Date().toISOString(),
  //       metadata: metadata || {}
  //     }
  //   };

  //   easlIframe.contentWindow.postMessage(message, 'https://easl-board.vercel.app/');
  //   console.log('📤 Sent query to EASL:', query);
  // }, []);

  // // Expose sendQueryToEASL globally
  // useEffect(() => {
  //   (window as any).sendQueryToEASL = sendQueryToEASL;
  // }, [sendQueryToEASL]);

  // // Listen for responses from EASL iframe
  // useEffect(() => {
  //   const handleEASLResponse = (event: MessageEvent) => {
  //     // Security check
  //     if (event.origin !== 'https://easl-board.vercel.app/') {
  //       return;
  //     }

  //     if (event.data?.type === 'EASL_RESPONSE') {
  //       const { response, timestamp } = event.data.payload;
  //       console.log('📥 Received response from EASL:', response);
  //       
  //       // Handle the response (e.g., display notification, update state)
  //       // You could create a new board item with the response
  //     }
  //   };

  //   window.addEventListener('message', handleEASLResponse);
  //   
  //   return () => {
  //     window.removeEventListener('message', handleEASLResponse);
  //   };
  // }, []);
  
  // ============================================================================
  // END EASL IFRAME CHATBOT
  // ============================================================================

  // Handle viewport changes
  const updateViewport = useCallback((newViewport) => {
    setViewport(newViewport);
    if (canvasRef.current) {
      canvasRef.current.style.transform = `translate(${newViewport.x}px, ${newViewport.y}px) scale(${newViewport.zoom})`;
    }
  }, []);

  // Center viewport on specific item with simple 3-step animation
  const centerOnItem = useCallback((itemId, finalZoom = 0.8, duration = 1200) => {
    const item = items.find((i) => i.id === itemId);
    if (!item || !canvasRef.current) return;

    const container = canvasRef.current.parentElement;
    if (!container) return;

    // Cancel any ongoing animation to prevent conflicts
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Get actual height from DOM if height is 'auto'
    let itemHeight = item.height;
    if (itemHeight === 'auto') {
      const domElement = document.querySelector(`[data-item-id="${item.id}"]`);
      if (domElement) {
        itemHeight = domElement.getBoundingClientRect().height / viewport.zoom;
        console.log(`📏 Measured auto-height for ${item.id}: ${itemHeight}px`);
      } else {
        // Fallback to estimated height if DOM element not found
        itemHeight = 400;
        console.warn(`⚠️ Could not measure height for ${item.id}, using fallback: ${itemHeight}px`);
      }
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const start = { ...viewport };
    const clampZoom = (z) => Math.max(0.1, Math.min(3, z));
    
    // Simple easing function
    const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    // 3 equal phases
    const phaseDuration = duration / 3;
    const t1 = phaseDuration;      // Step 1: zoom out
    const t2 = phaseDuration * 2;  // Step 2: move to target center
    const t3 = duration;           // Step 3: zoom in

    // Step 1: Zoom out from current viewport (to 30% of current zoom)
    const zoomOutZoom = clampZoom(start.zoom * 0.3);

    // Step 2: Calculate position to center the target object
    const targetObjectCenterX = item.x + item.width / 2;
    const targetObjectCenterY = item.y + itemHeight / 2;
    const targetViewportX = (containerWidth / 2) - targetObjectCenterX * zoomOutZoom;
    const targetViewportY = (containerHeight / 2) - targetObjectCenterY * zoomOutZoom;

    // Step 3: Calculate final position with target zoom
    const finalViewportX = (containerWidth / 2) - targetObjectCenterX * finalZoom;
    const finalViewportY = (containerHeight / 2) - targetObjectCenterY * finalZoom;

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      let current;
      if (elapsed <= t1) {
        // Step 1: Zoom out from current viewport center
        const k = easeInOut(elapsed / t1);
        const currentZoom = start.zoom + (zoomOutZoom - start.zoom) * k;
        
        // Keep current viewport center fixed during zoom out
        const currentCenterX = (containerWidth / 2 - start.x) / start.zoom;
        const currentCenterY = (containerHeight / 2 - start.y) / start.zoom;
        const newX = (containerWidth / 2) - currentCenterX * currentZoom;
        const newY = (containerHeight / 2) - currentCenterY * currentZoom;
        
        current = { x: newX, y: newY, zoom: currentZoom };
      } else if (elapsed <= t2) {
        // Step 2: Pan viewport to target object center
        const k = easeInOut((elapsed - t1) / (t2 - t1));
        // Get the current viewport position at the end of step 1
        const step1EndX = (containerWidth / 2) - ((containerWidth / 2 - start.x) / start.zoom) * zoomOutZoom;
        const step1EndY = (containerHeight / 2) - ((containerHeight / 2 - start.y) / start.zoom) * zoomOutZoom;
        
        const currentX = step1EndX + (targetViewportX - step1EndX) * k;
        const currentY = step1EndY + (targetViewportY - step1EndY) * k;
        
        current = { x: currentX, y: currentY, zoom: zoomOutZoom };
      } else {
        // Step 3: Zoom in to target object
        const k = easeInOut((elapsed - t2) / (t3 - t2));
        const currentX = targetViewportX + (finalViewportX - targetViewportX) * k;
        const currentY = targetViewportY + (finalViewportY - targetViewportY) * k;
        const currentZoom = zoomOutZoom + (finalZoom - zoomOutZoom) * k;
        
        current = { x: currentX, y: currentY, zoom: currentZoom };
      }

      updateViewport(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [items, viewport, updateViewport]);

  // Handle mouse wheel for zooming (zoom around cursor)
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();

    // Mouse position in screen space relative to container
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Compute new zoom
    const step = 0.1;
    const factor = e.deltaY > 0 ? 1 - step : 1 + step; // out vs in
    const newZoom = Math.max(0.1, Math.min(3, viewport.zoom * factor));

    // World coordinates under cursor before zoom
    const worldX = (mouseX - viewport.x) / viewport.zoom;
    const worldY = (mouseY - viewport.y) / viewport.zoom;

    // New translation so the same world point stays under cursor
    const newX = mouseX - worldX * newZoom;
    const newY = mouseY - worldY * newZoom;

    updateViewport({ x: newX, y: newY, zoom: newZoom });
  }, [viewport, updateViewport]);

  // Zoom functions for buttons (zoom around center)
  const handleZoomIn = useCallback(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Center of the viewport
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    const step = 0.2;
    const newZoom = Math.min(3, viewport.zoom * (1 + step));

    // World coordinates at center before zoom
    const worldX = (centerX - viewport.x) / viewport.zoom;
    const worldY = (centerY - viewport.y) / viewport.zoom;

    // New translation so the center stays at center
    const newX = centerX - worldX * newZoom;
    const newY = centerY - worldY * newZoom;

    updateViewport({ x: newX, y: newY, zoom: newZoom });
  }, [viewport, updateViewport]);

  const handleZoomOut = useCallback(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Center of the viewport
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    const step = 0.2;
    const newZoom = Math.max(0.1, viewport.zoom * (1 - step));

    // World coordinates at center before zoom
    const worldX = (centerX - viewport.x) / viewport.zoom;
    const worldY = (centerY - viewport.y) / viewport.zoom;

    // New translation so the center stays at center
    const newX = centerX - worldX * newZoom;
    const newY = centerY - worldY * newZoom;

    updateViewport({ x: newX, y: newY, zoom: newZoom });
  }, [viewport, updateViewport]);

  // Handle panning
  const handleMouseDown = useCallback((e) => {
    // Allow panning with left mouse button on canvas background, or middle mouse button
    if (e.button === 0 || e.button === 1) {
      // Only start panning if clicking on the canvas background (not on items)
      if (e.target === e.currentTarget || e.target.closest('[data-item-id]') === null) {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setLastPanPoint({ x: viewport.x, y: viewport.y });
      }
    }
  }, [viewport]);

  const handleMouseMove = useCallback((e) => {
    // This is now handled by global event listeners
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle canvas clicks
  const handleCanvasClick = useCallback((e) => {
    if (e.target === canvasRef.current) {
      onSelectItem(null);
    }
  }, [onSelectItem]);

  // Mouse event listeners for better panning
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDragging) {
        e.preventDefault();
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        
        updateViewport({
          x: lastPanPoint.x + deltaX,
          y: lastPanPoint.y + deltaY,
          zoom: viewport.zoom
        });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart, lastPanPoint, viewport.zoom, updateViewport]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'r' && e.ctrlKey) {
        e.preventDefault();
        // Cancel any ongoing animation
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        updateViewport({ x: 0, y: 0, zoom: 1 });
      }
      if (e.key === 'f' && e.ctrlKey) {
        e.preventDefault();
        // Center on first item if available
        if (items.length > 0) {
          centerOnItem(items[0].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [updateViewport, centerOnItem, items]);

  // Center on sub-element within an item
  const centerOnSubElement = useCallback((itemId, subElementSelector, finalZoom = 1.2, duration = 1200) => {
    const item = items.find((i) => i.id === itemId);
    if (!item || !canvasRef.current) return;

    const container = canvasRef.current.parentElement;
    if (!container) return;

    // Find the sub-element in the DOM
    const subElement = document.querySelector(`[data-focus-id="${subElementSelector}"]`);
    if (!subElement) {
      console.warn(`⚠️ Sub-element not found: ${subElementSelector}, centering on parent item`);
      centerOnItem(itemId, finalZoom, duration);
      return;
    }

    // Cancel any ongoing animation
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Get sub-element position relative to viewport
    const subRect = subElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Calculate sub-element center in world coordinates
    const subCenterScreenX = subRect.left + subRect.width / 2 - containerRect.left;
    const subCenterScreenY = subRect.top + subRect.height / 2 - containerRect.top;
    
    // Convert screen coordinates to world coordinates
    const subCenterWorldX = (subCenterScreenX - viewport.x) / viewport.zoom;
    const subCenterWorldY = (subCenterScreenY - viewport.y) / viewport.zoom;

    console.log(`📍 Sub-element center (world): (${subCenterWorldX}, ${subCenterWorldY})`);

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const start = { ...viewport };
    const clampZoom = (z) => Math.max(0.1, Math.min(3, z));
    
    const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const phaseDuration = duration / 3;
    const t1 = phaseDuration;
    const t2 = phaseDuration * 2;
    const t3 = duration;

    const zoomOutZoom = clampZoom(start.zoom * 0.3);

    // Calculate positions to center the sub-element
    const targetViewportX = (containerWidth / 2) - subCenterWorldX * zoomOutZoom;
    const targetViewportY = (containerHeight / 2) - subCenterWorldY * zoomOutZoom;

    const finalViewportX = (containerWidth / 2) - subCenterWorldX * finalZoom;
    const finalViewportY = (containerHeight / 2) - subCenterWorldY * finalZoom;

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      let current;
      if (elapsed <= t1) {
        const k = easeInOut(elapsed / t1);
        const currentZoom = start.zoom + (zoomOutZoom - start.zoom) * k;
        const currentCenterX = (containerWidth / 2 - start.x) / start.zoom;
        const currentCenterY = (containerHeight / 2 - start.y) / start.zoom;
        const newX = (containerWidth / 2) - currentCenterX * currentZoom;
        const newY = (containerHeight / 2) - currentCenterY * currentZoom;
        current = { x: newX, y: newY, zoom: currentZoom };
      } else if (elapsed <= t2) {
        const k = easeInOut((elapsed - t1) / (t2 - t1));
        const step1EndX = (containerWidth / 2) - ((containerWidth / 2 - start.x) / start.zoom) * zoomOutZoom;
        const step1EndY = (containerHeight / 2) - ((containerHeight / 2 - start.y) / start.zoom) * zoomOutZoom;
        const currentX = step1EndX + (targetViewportX - step1EndX) * k;
        const currentY = step1EndY + (targetViewportY - step1EndY) * k;
        current = { x: currentX, y: currentY, zoom: zoomOutZoom };
      } else {
        const k = easeInOut((elapsed - t2) / (t3 - t2));
        const currentX = targetViewportX + (finalViewportX - targetViewportX) * k;
        const currentY = targetViewportY + (finalViewportY - targetViewportY) * k;
        const currentZoom = zoomOutZoom + (finalZoom - zoomOutZoom) * k;
        current = { x: currentX, y: currentY, zoom: currentZoom };
      }

      updateViewport(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [items, viewport, updateViewport, centerOnItem]);

  // Expose centerOnItem function to parent
  useEffect(() => {
    if (onFocusRequest) {
      // Make centerOnItem available globally for focus requests
      (window as any).centerOnItem = centerOnItem;
      (window as any).centerOnSubElement = centerOnSubElement;
    }
  }, [centerOnItem, centerOnSubElement, onFocusRequest]);

  // Expose helper to place an item at current viewport center and persist
  useEffect(() => {
    (window as any).placeItemAtViewportCenter = async (itemId: string) => {
      try {
        const container = canvasRef.current?.parentElement as HTMLElement | null;
        if (!container) return;
        const item = items.find((i) => i.id === itemId);
        if (!item) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // World coords of viewport center
        const centerWorldX = (containerWidth / 2 - viewport.x) / viewport.zoom;
        const centerWorldY = (containerHeight / 2 - viewport.y) / viewport.zoom;

        const newX = Math.round(centerWorldX - (item.width || 0) / 2);
        const newY = Math.round(centerWorldY - (item.height || 0) / 2);

        onUpdateItem(itemId, { x: newX, y: newY });

        // Persist to backend if available (session-aware)
        try {
          const sessionId = localStorage.getItem('boardSessionId') || 
                           new URLSearchParams(window.location.search).get('sessionId');
          
          if (sessionId) {
            await fetch(`/api/board-items/${itemId}?sessionId=${sessionId}`, {
              method: 'PUT',
              headers: { 
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
              },
              body: JSON.stringify({ x: newX, y: newY })
            });
          }
        } catch (_) { /* ignore */ }
      } catch (_) { /* ignore */ }
    };
  }, [items, viewport, onUpdateItem]);

  // Expose a getter for current viewport center in world coordinates
  useEffect(() => {
    (window as any).getViewportCenterWorld = () => {
      const container = canvasRef.current?.parentElement as HTMLElement | null;
      if (!container) return null;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const x = (containerWidth / 2 - viewport.x) / viewport.zoom;
      const y = (containerHeight / 2 - viewport.y) / viewport.zoom;
      return { x, y, zoom: viewport.zoom };
    };
  }, [viewport]);

  return (
    <CanvasContainer
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <CanvasContent
        ref={canvasRef}
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {/* Render Zones - Behind objects */}
        {zoneConfig.zones.map((zone) => (
          <ZoneContainer
            key={zone.name}
            style={{
              left: zone.x,
              top: zone.y,
              width: zone.width,
              height: zone.height,
              borderColor: zone.color,
            }}
            color={zone.color}
            gradient={zone.gradient}
            borderGradient={zone.borderGradient}
          >
            <ZoneLabel>
              {zone.label}
            </ZoneLabel>
          </ZoneContainer>
        ))}

        {/* Render Objects - On top of zones */}
        <AnimatePresence>
          {items.map((item) => {
            // Debug: Log if item is in Retrieved Data Zone
            if (item.x >= 4200 && item.x < 6200 && item.y >= -4600 && item.y < -2500) {
              console.log(`🎨 Rendering Retrieved Data Zone item: ${item.id} (${item.type}) at (${item.x}, ${item.y})`);
            }
            return (
              <BoardItem
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                onUpdate={onUpdateItem}
                onDelete={onDeleteItem}
                onSelect={onSelectItem}
              />
            );
          })}
        </AnimatePresence>
      </CanvasContent>

      {/* Zoom Controls */}
      <ZoomControls>
        <AddNoteButton
          onClick={handleAddNote}
          title="Add Doctor's Note"
        >
          📝
        </AddNoteButton>
        <DeleteButton
          onClick={() => setShowResetModal(true)}
          title="Reset Board (Delete All API Items)"
        >
          ✕
        </DeleteButton>
        <ZoomButton
          onClick={handleZoomIn}
          disabled={viewport.zoom >= 3}
          title="Zoom In"
        >
          +
        </ZoomButton>
        <ZoomButton
          onClick={handleZoomOut}
          disabled={viewport.zoom <= 0.1}
          title="Zoom Out"
        >
          −
        </ZoomButton>
      </ZoomControls>

      {/* Instructions */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 1000
      }}>
        Left click empty area to pan • Middle mouse to pan • Mouse wheel to zoom • Ctrl+R to reset view • Ctrl+F to focus on first item
      </div>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetModal && (
          <ModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowResetModal(false)}
          >
            <ModalContent
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalTitle>
                <span>⚠️</span>
                Reset Board
              </ModalTitle>
              
              <ModalText>
                This will delete <strong>ALL API-added items</strong> from the board.
              </ModalText>
              
              <ModalText>
                <strong>Items that will be deleted:</strong>
              </ModalText>
              <ModalList>
                <li>Todos and Enhanced Todos</li>
                <li>Agent Results</li>
                <li>Doctor's Notes</li>
                <li>Lab Results</li>
                <li>Dashboard Components</li>
              </ModalList>
              
              <ModalText>
                <strong>Items that will remain:</strong>
              </ModalText>
              <ModalList>
                <li>Raw EHR Data</li>
                <li>Single Encounter Data</li>
              </ModalList>
              
              <ModalWarning>
                ⚠️ This action CANNOT be undone!
              </ModalWarning>
              
              <ModalButtons>
                <ModalButton
                  variant="secondary"
                  onClick={() => setShowResetModal(false)}
                >
                  Cancel
                </ModalButton>
                <ModalButton
                  variant="danger"
                  onClick={handleResetBoard}
                >
                  Delete All Items
                </ModalButton>
              </ModalButtons>
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </CanvasContainer>
  );
};

export default Canvas;