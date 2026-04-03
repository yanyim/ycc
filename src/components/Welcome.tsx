import React from 'react';
import { Box, Text } from 'ink';

export const Welcome: React.FC = () => {
    return (
        <Box paddingY={1} flexDirection="column" alignItems="center">
            <Text color="cyan" bold>
                {`
   █████╗ ██╗    ██████╗  █████╗ ███╗   ██╗███████╗██╗
  ██╔══██╗██║    ██╔══██╗██╔══██╗████╗  ██║██╔════╝██║
  ███████║██║    ██████╔╝███████║██╔██╗ ██║█████╗  ██║
  ██╔══██║██║    ██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝  ██║
  ██║  ██║██║    ██║     ██║  ██║██║ ╚████║███████╗███████╗
  ╚═╝  ╚═╝╚═╝    ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝
        `}
            </Text>
            <Text color="gray">✨ 欢迎进入智能体 CLI 控制台 ✨</Text>
        </Box>
    );
};