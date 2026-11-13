package io.github.dante138.foco;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // O botão voltar do Android anda para trás no histórico da página: é assim que o app
        // fecha a folha aberta (www/js/ui.js). O Capacitor só faz isso com o plugin App, que
        // este projeto não usa. Sem histórico para voltar, vale o padrão do sistema: sair do app.
        getOnBackPressedDispatcher()
            .addCallback(
                this,
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        WebView pagina = getBridge().getWebView();
                        if (pagina.canGoBack()) {
                            pagina.goBack();
                            return;
                        }
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    }
                }
            );
    }
}
