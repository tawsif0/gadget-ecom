import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  loadPublicSettings,
  selectPublicSettings,
  selectPublicSettingsState,
} from "../store/publicSettingsSlice";

export const usePublicSettings = ({ force = false } = {}) => {
  const dispatch = useDispatch();
  const settings = useSelector(selectPublicSettings);
  const state = useSelector(selectPublicSettingsState);

  useEffect(() => {
    if (force || (!state.loaded && state.status === "idle")) {
      dispatch(loadPublicSettings({ force }));
    }
  }, [dispatch, force, state.loaded, state.status]);

  return {
    settings,
    status: state.status,
    error: state.error,
    loaded: state.loaded,
    reload: () => dispatch(loadPublicSettings({ force: true })),
  };
};

export default usePublicSettings;
