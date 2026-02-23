import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface CompanyConfirmationProps {
  resolvedName: string;   // dossier.targetCompany
  userInput: string;      // what the user typed
  onConfirm: () => void;
  onAbort: () => void;
}

const CompanyConfirmation = ({ resolvedName, userInput, onConfirm, onAbort }: CompanyConfirmationProps) => {
  const needsUserInputNote = resolvedName.toLowerCase() !== userInput.toLowerCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto px-6 sm:px-8 space-y-4 my-4"
    >
      <div className="codec-border bg-black p-4 text-center">
        <h3 className="text-xl font-bold text-green-400 tracking-wider mb-2">▶ TARGET IDENTIFIED</h3>
        <p className="text-3xl font-mono text-white uppercase mb-4">{resolvedName}</p>
        {needsUserInputNote && (
          <p className="text-sm text-gray-400 font-mono italic mb-4">
            (You searched: {userInput})
          </p>
        )}
        <div className="flex justify-center space-x-4">
          <Button
            className="codec-button bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 uppercase tracking-widest text-xs"
            onClick={onConfirm}
          >
            CONFIRM TARGET
          </Button>
          <Button
            className="codec-button bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 uppercase tracking-widest text-xs"
            onClick={onAbort}
          >
            ABORT MISSION
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default CompanyConfirmation;
