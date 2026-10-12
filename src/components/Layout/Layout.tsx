import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../Header/Header';
import { Sidebar } from '../Sidebar/Sidebar';
import { TaskModal } from '../TaskModal/TaskModal';
import type { Tarefa } from '../../types/Tarefa';
import './Layout.css';

export type LayoutContext = { abrirTaskModal: () => void; editarTaskModal: (tarefa: Tarefa) => void };

export function Layout() {
  const [taskModalAberto, setTaskModalAberto] = useState(false);
  const [tarefaEmEdicao, setTarefaEmEdicao] = useState<Tarefa | null>(null);
  function abrirTaskModal() { setTarefaEmEdicao(null); setTaskModalAberto(true); }
  function editarTaskModal(tarefa: Tarefa) { setTarefaEmEdicao(tarefa); setTaskModalAberto(true); }
  function fecharTaskModal() { setTaskModalAberto(false); setTarefaEmEdicao(null); }

  return (
    <>
      <div className="app-layout">
        <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
        <Sidebar aoNovaTarefa={abrirTaskModal} />
        <div className="app-layout__content">
          <Header aoNovaTarefa={abrirTaskModal} />
          <main className="app-layout__main" id="conteudo" tabIndex={-1}>
            <Outlet context={{ abrirTaskModal, editarTaskModal } satisfies LayoutContext} />
          </main>
        </div>
      </div>
      <TaskModal aberto={taskModalAberto} tarefa={tarefaEmEdicao} aoFechar={fecharTaskModal} />
    </>
  );
}
