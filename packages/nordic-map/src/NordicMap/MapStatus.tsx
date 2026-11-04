import classes from "./MapStatus.module.css";

type MapStatusProps = {
  failed: boolean;
  loadingLabel: string;
  errorText: string;
};

/** A spinner while the map data loads, or a message when it could not be loaded, in the middle of the map */
export function MapStatus({ failed, loadingLabel, errorText }: MapStatusProps) {
  return (
    <div className={classes.status}>
      {failed ? (
        <div className={classes.error} role="alert">
          {errorText}
        </div>
      ) : (
        <div className={classes.spinner} role="status" aria-label={loadingLabel} />
      )}
    </div>
  );
}
