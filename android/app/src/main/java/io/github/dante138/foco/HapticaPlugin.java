package io.github.dante138.foco;

import android.os.Build;
import android.view.HapticFeedbackConstants;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Resposta tátil pelos efeitos do próprio sistema (performHapticFeedback), e não por vibração
 * com duração fixa: o toque é o do aparelho e segue a opção de vibração ao toque do Android.
 * Não precisa da permissão VIBRATE. Chamado pela página em www/js/ui.js (vibrar).
 * Os efeitos mais novos (API 30 e 34) caem nos antigos em aparelhos mais velhos.
 */
@CapacitorPlugin(name = "Haptica")
public class HapticaPlugin extends Plugin {

    @PluginMethod
    public void tocar(PluginCall call) {
        int efeito = efeito(call.getString("tipo", "marcar"));
        getActivity()
            .runOnUiThread(() -> {
                getBridge().getWebView().performHapticFeedback(efeito);
                call.resolve();
            });
    }

    private static int efeito(String tipo) {
        switch (tipo) {
            case "desmarcar":
                return Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                    ? HapticFeedbackConstants.TOGGLE_OFF
                    : HapticFeedbackConstants.KEYBOARD_TAP;
            case "concluido":
                return Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? HapticFeedbackConstants.CONFIRM
                    : HapticFeedbackConstants.VIRTUAL_KEY;
            case "segurar":
                return HapticFeedbackConstants.LONG_PRESS;
            case "arrastar":
                return Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                    ? HapticFeedbackConstants.DRAG_START
                    : HapticFeedbackConstants.LONG_PRESS;
            default: // marcar
                return Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                    ? HapticFeedbackConstants.TOGGLE_ON
                    : HapticFeedbackConstants.VIRTUAL_KEY;
        }
    }
}
