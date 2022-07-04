import Portis from "@portis/web3";
import { IExec, utils } from "iexec";
import axios from 'axios';
import {spawnProgressBar, updateProgressBar, displayPreviousDeals, addNewResult, enableDownloadButton} from './tools';

const networkOutput = document.getElementById("network-output");
const myForm = document.getElementById('myForm');
const myFile = document.getElementById('myFile'); 

const refreshUser = (iexec) => async () => {
  const userAddress = await iexec.wallet.getAddress();
  const [wallet, account] = await Promise.all([iexec.wallet.checkBalances(userAddress),
    iexec.account.checkBalance(userAddress)]);
};

const checkStorage = (iexec) => async () => {
  try {
    const isStorageInitialized = await iexec.storage.checkStorageTokenExists(
      await iexec.wallet.getAddress()
    );
    if(!isStorageInitialized) {
        alert('Please initialize your iExec storage');
        initStorage(iexec)();
    }
  } catch (error) {
    alert(error);
  }
};

const initStorage = (iexec) => async () => {
  try {
    const storageToken = await iexec.storage.defaultStorageLogin();
    await iexec.storage.pushStorageToken(storageToken, { forceUpdate: true });
    checkStorage(iexec)();
  } catch (error) {
        alert(error);
  }
};

const buyComputation = (iexec, ipfs_url) => async () => {
  try {
    updateProgressBar('40%', 'Complete order...');
    const appAddress = '0x8326dec6de9546046de50b9fd77703ea9794f399';
    const category = 0;
    const workerpool = '0x5210cD9C57546159Ac60DaC17B3e6cDF48674FBD';

    const params = {"iexec_input_files": [ipfs_url, "https://github.com/jbekkink/test_classifier/raw/main/classifier.h5"]}
    const { orders: appOrders } = await iexec.orderbook.fetchAppOrderbook(
      appAddress
    );
    const appOrder = appOrders && appOrders[0] && appOrders[0].order;
    if (!appOrder) throw Error(`no apporder found for app ${appAddress}`);
    const {
      orders: workerpoolOrders
    } = await iexec.orderbook.fetchWorkerpoolOrderbook({category, workerpool});
    const workerpoolOrder =
      workerpoolOrders && workerpoolOrders[0] && workerpoolOrders[0].order;
    if (!workerpoolOrder)
      throw Error(`no workerpoolorder found for category ${category}`);

    const userAddress = await iexec.wallet.getAddress();

    const requestOrderToSign = await iexec.order.createRequestorder({
      app: appAddress,
      appmaxprice: appOrder.appprice,
      workerpoolmaxprice: workerpoolOrder.workerpoolprice,
      requester: userAddress,
      volume: 1,
      params: params,
      category: category
    });

    const requestOrder = await iexec.order.signRequestorder(requestOrderToSign);

    const res = await iexec.order.matchOrders({
      apporder: appOrder,
      requestorder: requestOrder,
      workerpoolorder: workerpoolOrder
    }); 
    updateProgressBar('70%', 'Executing computation...');
    refreshUser(iexec)();
    
    const deal = await iexec.deal.show(res.dealid);
    return deal; 
  } catch (error) {
        alert(error);
  }
};

const init = async () => {
  try {
    const uploadbutton = document.querySelector('.upload form button');
    uploadbutton.disabled = true;
    let ethProvider;
    if (window.ethereum) {
      console.log("using default provider");
      ethProvider = window.ethereum;
      ethProvider.on("chainChanged", (_chainId) => window.location.reload());
      ethProvider.on("accountsChanged", (_accounts) =>
        window.location.reload()
      );
      await window.ethereum.request({
        method: "eth_requestAccounts"
      });
      window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x85",
            chainName: "iExec Test Sidechain",
            nativeCurrency: {
              name: "xRLC",
              symbol: "xRLC",
              decimals: 18
            },
            rpcUrls: ["https://viviani.iex.ec"],
            blockExplorerUrls: ["https://blockscout-viviani.iex.ec"]
          }
        ]
      });
    } else {
      console.log("using Portis");
      ethProvider = new Portis("92fb92d5-07f8-463a-91e5-9c6c49fd88e5", {
        nodeUrl: "https://viviani.iex.ec",
        chainId: 133,
        nodeProtocol: "rpc"
      }).provider;
      await ethProvider.enable();
    }

    const { result } = await new Promise((resolve, reject) =>
      ethProvider.sendAsync(
        {
          jsonrpc: "2.0",
          method: "net_version",
          params: []
        },
        (err, res) => {
          if (!err) resolve(res);
          reject(Error(`Failed to get network version from provider: ${err}`));
        }
      )
    );
    const networkVersion = result;

    if (networkVersion !== "133") {
      const error = `Unsupported network ${networkVersion}, please switch to iExec Test Sidechain`;
      networkOutput.innerText = "Switch to iExec Test Sidechain";
      alert(error);
      throw Error(error);
    }

    networkOutput.innerText = networkOutput.innerText = "Connected to the iExec Test Sidechain";
    const iexec = new IExec({
      ethProvider
    });

    await refreshUser(iexec)();
    await checkStorage(iexec)();
    await displayPreviousDeals(iexec); 

    myForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      uploadbutton.disabled = true;
      const file = myFile.files[0];
      var data = new FormData();
      data.append('file', file);
      var config = {
        method: 'post',
        url: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
        headers: { 
          //ADD YOUR BEARER TOKEN BELOW
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI0ZGM4YzhkZS1hMTQ4LTRlMzEtYWI0Ni1jN2ZhOTExY2MwZGMiLCJlbWFpbCI6ImpvZXlqb2V5YjA5QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImlkIjoiRlJBMSIsImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxfV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiIwMDkwNjY0OGVmODY0YmFmZjlmMCIsInNjb3BlZEtleVNlY3JldCI6Ijc2NDZkZmE5MzQ2YzY4Y2EyNjQ1NzUyYjRiNjBmYTkxYmU4ZTM4NTgxYWU2NzliY2Y5MDM4ZTU5MDgxYjM0ZjIiLCJpYXQiOjE2NTY1NzM5MDV9.dFuNAiO-YmrNZIC5qW-ksMt6xPJPwYa1NYzNQ9Mc8eA'
        },
        data : data
      };
      spawnProgressBar();
      const res = await axios(config);
      const cid = res.data.IpfsHash;
      const multiaddr=`/ipfs/${cid}`;
      const ipfs_url = `https://gateway.pinata.cloud${multiaddr}`+ '?filename=' + file.name;
      
      await fetch(ipfs_url).then((res) => {
        console.log(res);
        if (!res.ok) {
          throw Error(`Failed to load uploaded file at ${ipfs_url}`);
      }    
      }); 
      updateProgressBar('25%', 'Image uploaded...');
      const deal = await buyComputation(iexec, ipfs_url)();
      uploadbutton.disabled = false;
      await addNewResult(iexec, deal);
      await enableDownloadButton(iexec, deal);
      updateProgressBar('100%', 'Result is ready!');
      
    });
    uploadbutton.disabled = false;
    console.log("initialized");

  } catch (e) {
    console.error(e.message);
  }
};
init();
