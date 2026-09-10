import { colors } from './theme';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ClientsScreen, FinanceScreen, InventoryScreen, ProfileScreen, ReportsScreen } from './components/ProfessionalScreens';
import { AgendaScreen } from './components/AgendaScreen';
import { EquipmentScreen } from './components/EquipmentScreen';
import { BookingLinkScreen, BusinessHoursScreen } from './components/BookingScreens';
import { CostsScreen, PlansScreen, PricingScreen, ServicesScreen } from './components/BusinessScreens';
import { AuthView, type AuthScreen } from './components/AuthScreens';
import { OnboardingView } from './components/OnboardingScreens';
import { AppFrame, AppTabs } from './components/AppChrome';
import { HomeScreen } from './components/HomeScreen';
import { Button, Loading, Notice, Screen, ScreenHeader } from './components/ui';
import { AppProvider, useApp } from './state/AppProvider';
import { DialogProvider } from './components/Dialog';

type Tab = 'inicio' | 'calcular' | 'servicos' | 'custos' | 'planos' | 'clientes' | 'agenda' | 'agenda-online' | 'expediente' | 'financeiro' | 'estoque' | 'equipamentos' | 'relatorios' | 'perfil';

export default function App() {
  return <AppFrame><AppProvider><DialogProvider><BeautyContaApp /></DialogProvider></AppProvider></AppFrame>;
}

function BeautyContaApp() {
  const app = useApp();
  const [authMode, setAuthMode] = useState<AuthScreen>('welcome');
  const [activeTab, setActiveTab] = useState<Tab>('inicio');
  /**
   * De onde a usuária entrou nos equipamentos.
   *
   * A tela passou a ter duas portas — a Home e o Perfil —, e voltar tem de
   * devolvê-la à porta por onde ela entrou. Sem isto, quem chega pela Home é
   * jogado no Perfil ao tocar em voltar.
   */
  const [equipmentOrigin, setEquipmentOrigin] = useState<Tab>('perfil');

  const navigate = (tab: Tab) => {
    if (tab === 'equipamentos' && activeTab !== 'equipamentos') setEquipmentOrigin(activeTab);
    setActiveTab(tab);
  };

  const home = () => setActiveTab('inicio');
  const plans = () => setActiveTab('planos');

  if (app.status === 'loading') {
    return <View style={styles.screen}><StatusBar style="dark" /><Loading label="Abrindo sua conta..." full /></View>;
  }

  if (app.status === 'signed-out') {
    return <View style={styles.screen}>
      <StatusBar style="dark" />
      {app.loadError
        ? <FailedToLoad message={app.loadError} onRetry={() => void app.reload()} />
        : <AuthView mode={authMode} onMode={setAuthMode} />}
    </View>;
  }

  // Conta criada, negócio ou configuração faltando: a jornada continua de onde
  // parou, sem passar pela tela de entrada de novo.
  if (app.status === 'onboarding') {
    return <View style={styles.screen}><StatusBar style="dark" /><OnboardingView /></View>;
  }

  // Todas as telas seguem a mesma moldura da Home: cabeçalho, destaque e seções.
  const screen = {
    inicio: <HomeScreen onNavigate={navigate} />,
    calcular: <PricingScreen onBack={home} onUpgrade={plans} onEquipment={() => navigate('equipamentos')} />,
    servicos: <ServicesScreen onBack={home} onUpgrade={plans} />,
    custos: <CostsScreen onBack={home} onUpgrade={plans} />,
    planos: <PlansScreen onBack={home} />,
    clientes: <ClientsScreen onBack={home} />,
    agenda: <AgendaScreen onBack={home} onAction={(action) => navigate(routeOf(action))} />,
    'agenda-online': <BookingLinkScreen onBack={() => setActiveTab('agenda')} onAction={(action) => navigate(routeOf(action))} />,
    expediente: <BusinessHoursScreen onBack={() => setActiveTab('perfil')} onAction={(action) => navigate(routeOf(action))} />,
    financeiro: <FinanceScreen onBack={home} onAction={(action) => navigate(routeOf(action))} />,
    estoque: <InventoryScreen onBack={home} onAction={(action) => { if (action === 'plans') plans(); }} />,
    equipamentos: <EquipmentScreen onBack={() => setActiveTab(equipmentOrigin)} />,
    relatorios: <ReportsScreen onBack={home} onAction={(action) => navigate(routeOf(action))} />,
    perfil: <ProfileScreen onBack={home} onAction={(action) => navigate(routeOf(action))} />,
  }[activeTab];

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      {screen}
      <AppTabs active={activeTab} onChange={navigate} />
    </View>
  );
}

/** Atalhos que as telas pedem por nome, para não conhecerem o roteador. */
function routeOf(action: string): Tab {
  if (action === 'services') return 'servicos';
  if (action === 'costs') return 'custos';
  if (action === 'pricing') return 'calcular';
  if (action === 'plans') return 'planos';
  if (action === 'booking') return 'agenda-online';
  if (action === 'hours') return 'expediente';
  if (action === 'equipment') return 'equipamentos';
  return 'inicio';
}

/** Falha ao carregar os dados: a usuária vê o motivo e pode tentar de novo. */
function FailedToLoad({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <Screen>
    <ScreenHeader title="Não conseguimos carregar" subtitle="Seus dados continuam salvos no servidor." />
    <Notice message={message} />
    <Button label="Tentar de novo" icon="arrow" onPress={onRetry} />
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
