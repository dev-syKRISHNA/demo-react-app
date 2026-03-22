import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { VirtualMachineWizard } from './VirtualMachineWizard';

export const VirtualMachineCreateBlade: React.FC = () => {
  const { tabId = 'basics' } = useParams<{ tabId: string }>();
  const navigate = useNavigate();

  // If a child blade is open, render it in an overlay; otherwise render the VM wizard
  const isChildBladeOpen = window.location.pathname.split('/').length > 5;

  return (
    <div className="h-full flex">
      {/* Main VM wizard blade */}
      <VirtualMachineWizard
        initialTab={tabId}
        onTabChange={(newTab) => navigate(`/virtual-machines/create/${newTab}`)}
      />

      {/* Nested child blade overlay */}
      {isChildBladeOpen && <Outlet />}
    </div>
  );
};
