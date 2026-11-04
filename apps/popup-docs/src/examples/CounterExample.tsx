import { useState } from 'react'
import { usePopupWindow } from '@jielga/react-popup-window'

export function CounterExample() {
  const [count, setCount] = useState(0)
  const { open, close, isOpen, isBlocked, Popup } = usePopupWindow({
    title: 'Counter panel',
    features: { width: 340, height: 260 },
  })

  return (
    <div>
      <div className="row">
        <button onClick={open} data-testid="open-counter">
          Open panel
        </button>
        {isOpen && (
          <button className="secondary" onClick={close} data-testid="close-counter">
            Close panel
          </button>
        )}
        <span className="muted">
          shared count: <strong data-testid="parent-count">{count}</strong>
        </span>
      </div>
      {isBlocked && <p>The browser blocked the popup — allow popups for this site.</p>}
      <Popup>
        <div className="popup-panel">
          <h2>Popup counter</h2>
          <p>
            This button is rendered in the popup window. Its <code>onClick</code> updates state
            owned by a component in the main window; both windows render the same value.
          </p>
          <div className="row">
            <button onClick={() => setCount((c) => c + 1)} data-testid="increment">
              +1
            </button>
            <span>
              count: <strong data-testid="popup-count">{count}</strong>
            </span>
          </div>
        </div>
      </Popup>
    </div>
  )
}
